import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env';
import { AdminCredential, AdminSession } from '../../models/AdminCredential';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { asyncHandler, HttpError, sendSuccess } from '../../utils/apiResponse';
import { recordAuditLog, resolveSourceApp } from '../../services/auditService';
import { sendAdminPasswordResetEmail } from '../../services/mailService';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(6).max(12),
  newPassword: z.string().min(8).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseExpiresMs(expr: string, fallbackMs: number): number {
  const match = /^(\d+)([smhd])$/.exec(expr.trim());
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2];
  const mult: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * (mult[unit] || 1000);
}

function issueTokens(adminId: string, email: string, sessionId: string) {
  const accessToken = jwt.sign(
    {
      sub: adminId,
      email,
      role: 'platform_admin',
      sessionId,
      tokenType: 'admin_access',
    },
    env.jwtAdminAccessSecret,
    { expiresIn: env.jwtAdminAccessExpiresIn } as SignOptions
  );

  const refreshToken = jwt.sign(
    {
      sub: adminId,
      email,
      role: 'platform_admin',
      sessionId,
      tokenType: 'admin_refresh',
    },
    env.jwtAdminRefreshSecret,
    { expiresIn: env.jwtAdminRefreshExpiresIn } as SignOptions
  );

  return { accessToken, refreshToken };
}

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const sourceApp = resolveSourceApp(req);

    const adminAccount = await AdminCredential.findOne({
      singletonKey: 'PLATFORM_ADMIN',
      email: body.email.toLowerCase(),
    });

    if (!adminAccount) {
      throw new HttpError(401, 'Invalid Admin credentials.');
    }

    const valid = await bcrypt.compare(body.password, adminAccount.passwordHash);
    if (!valid) {
      await recordAuditLog({
        actorId: adminAccount._id,
        actorEmail: adminAccount.email,
        sourceApp,
        action: 'ADMIN_LOGIN_FAILED',
        entityType: 'admin_auth',
        entityId: adminAccount._id.toString(),
        summary: `Failed Admin login attempt from ${sourceApp}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      throw new HttpError(401, 'Invalid Admin credentials.');
    }

    const refreshTtlMs = parseExpiresMs(env.jwtAdminRefreshExpiresIn, 7 * 24 * 60 * 60 * 1000);
    const session = new AdminSession({
      adminId: adminAccount._id,
      refreshTokenHash: 'pending',
      sourceApp,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + refreshTtlMs),
    });

    const { accessToken, refreshToken } = issueTokens(
      adminAccount._id.toString(),
      adminAccount.email,
      session._id.toString()
    );
    session.refreshTokenHash = sha256(refreshToken);
    await session.save();

    adminAccount.lastLoginAt = new Date();
    await adminAccount.save();

    await recordAuditLog({
      actorId: adminAccount._id,
      actorEmail: adminAccount.email,
      sourceApp,
      action: 'ADMIN_LOGIN_SUCCESS',
      entityType: 'admin_session',
      entityId: session._id.toString(),
      summary: `Admin signed in via ${sourceApp}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(
      res,
      {
        accessToken,
        refreshToken,
        admin: {
          id: adminAccount._id.toString(),
          email: adminAccount.email,
          name: adminAccount.name,
          role: 'platform_admin',
          lastLoginAt: adminAccount.lastLoginAt,
        },
        sessionId: session._id.toString(),
      },
      'Admin login successful.'
    );
  })
);

router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = forgotSchema.parse(req.body);
    const sourceApp = resolveSourceApp(req);

    const adminAccount = await AdminCredential.findOne({
      singletonKey: 'PLATFORM_ADMIN',
      email: body.email.toLowerCase(),
    });

    if (adminAccount) {
      const otp = String(crypto.randomInt(100000, 999999));
      adminAccount.resetOtpHash = sha256(otp);
      adminAccount.resetOtpExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await adminAccount.save();

      const emailResult = await sendAdminPasswordResetEmail({
        to: adminAccount.email,
        otp,
        expiresMinutes: 15,
      });

      await recordAuditLog({
        actorId: adminAccount._id,
        actorEmail: adminAccount.email,
        sourceApp,
        action: 'ADMIN_PASSWORD_RESET_REQUESTED',
        entityType: 'admin_auth',
        entityId: adminAccount._id.toString(),
        summary: `Admin password reset OTP requested (SMTP delivered: ${emailResult.delivered})`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      if (!emailResult.delivered && env.nodeEnv !== 'production') {
        console.info(`[DEV ONLY] Admin Password Reset OTP for ${adminAccount.email}: ${otp}`);
      }
    }

    return sendSuccess(
      res,
      { requested: true },
      'If the configured Admin email matches, a verification code has been dispatched.'
    );
  })
);

router.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = resetSchema.parse(req.body);
    const sourceApp = resolveSourceApp(req);

    const adminAccount = await AdminCredential.findOne({
      singletonKey: 'PLATFORM_ADMIN',
      email: body.email.toLowerCase(),
    });

    if (
      !adminAccount ||
      !adminAccount.resetOtpHash ||
      !adminAccount.resetOtpExpiresAt ||
      adminAccount.resetOtpExpiresAt.getTime() < Date.now() ||
      adminAccount.resetOtpHash !== sha256(body.otp)
    ) {
      throw new HttpError(400, 'Invalid or expired password reset verification code.');
    }

    adminAccount.passwordHash = await bcrypt.hash(body.newPassword, 12);
    adminAccount.resetOtpHash = null;
    adminAccount.resetOtpExpiresAt = null;
    await adminAccount.save();

    // Revoke all existing sessions on password reset
    await AdminSession.updateMany(
      { adminId: adminAccount._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    await recordAuditLog({
      actorId: adminAccount._id,
      actorEmail: adminAccount.email,
      sourceApp,
      action: 'ADMIN_PASSWORD_RESET_COMPLETED',
      entityType: 'admin_auth',
      entityId: adminAccount._id.toString(),
      summary: 'Admin password reset completed and all prior sessions revoked',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { reset: true }, 'Password has been reset. Please log in again.');
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);

    let payload: { sub: string; email: string; role: string; sessionId: string; tokenType: string };
    try {
      payload = jwt.verify(refreshToken, env.jwtAdminRefreshSecret) as typeof payload;
    } catch {
      throw new HttpError(401, 'Invalid or expired refresh token.');
    }

    if (payload.role !== 'platform_admin' || payload.tokenType !== 'admin_refresh') {
      throw new HttpError(403, 'Forbidden: invalid token scope.');
    }

    const session = await AdminSession.findOne({
      _id: payload.sessionId,
      adminId: payload.sub,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!session || session.refreshTokenHash !== sha256(refreshToken)) {
      throw new HttpError(401, 'Session expired or refresh token revoked.');
    }

    const tokens = issueTokens(payload.sub, payload.email, session._id.toString());
    session.refreshTokenHash = sha256(tokens.refreshToken);
    session.lastUsedAt = new Date();
    await session.save();

    return sendSuccess(res, tokens, 'Token refreshed.');
  })
);

router.post(
  '/logout',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);

    await AdminSession.updateOne(
      { _id: admin.sessionId, adminId: admin.id },
      { $set: { revokedAt: new Date() } }
    );

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'ADMIN_LOGOUT',
      entityType: 'admin_session',
      entityId: admin.sessionId,
      summary: `Admin logged out from ${sourceApp}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { loggedOut: true }, 'Logged out successfully.');
  })
);

router.get(
  '/me',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const adminAccount = await AdminCredential.findById(req.admin!.id).select('_id email name lastLoginAt');
    if (!adminAccount) {
      throw new HttpError(404, 'Admin account not found.');
    }
    return sendSuccess(res, {
      id: adminAccount._id.toString(),
      email: adminAccount.email,
      name: adminAccount.name,
      role: 'platform_admin',
      lastLoginAt: adminAccount.lastLoginAt,
    });
  })
);

router.get(
  '/sessions',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const sessions = await AdminSession.find({
      adminId: req.admin!.id,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .sort({ lastUsedAt: -1 })
      .lean();

    const mapped = sessions.map((s) => ({
      id: s._id.toString(),
      sourceApp: s.sourceApp,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
      isCurrent: s._id.toString() === req.admin!.sessionId,
    }));

    return sendSuccess(res, mapped);
  })
);

router.delete(
  '/sessions/:sessionId',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const admin = req.admin!;
    const sourceApp = resolveSourceApp(req);
    const sessionId = String(req.params.sessionId);

    const session = await AdminSession.findOne({ _id: sessionId, adminId: admin.id, revokedAt: null });
    if (!session) {
      throw new HttpError(404, 'Active session not found.');
    }

    session.revokedAt = new Date();
    await session.save();

    await recordAuditLog({
      actorId: admin.id,
      actorEmail: admin.email,
      sourceApp,
      action: 'ADMIN_SESSION_REVOKED',
      entityType: 'admin_session',
      entityId: sessionId,
      summary: `Revoked Admin session ${sessionId}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return sendSuccess(res, { revoked: true }, 'Session revoked.');
  })
);

export default router;
