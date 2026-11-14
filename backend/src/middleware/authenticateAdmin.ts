import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AdminCredential, AdminSession } from '../models/AdminCredential';
import { HttpError } from '../utils/apiResponse';

export interface AdminAccessPayload {
  sub: string;
  email: string;
  role: 'platform_admin';
  sessionId: string;
  tokenType: 'admin_access';
}

declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        email: string;
        name: string;
        sessionId: string;
      };
    }
  }
}

export async function authenticateAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpError(401, 'Admin authentication token is required.');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    let payload: AdminAccessPayload;
    try {
      payload = jwt.verify(token, env.jwtAdminAccessSecret) as AdminAccessPayload;
    } catch {
      throw new HttpError(401, 'Invalid or expired Admin access token.');
    }

    if (payload.role !== 'platform_admin' || payload.tokenType !== 'admin_access' || !payload.sessionId) {
      throw new HttpError(403, 'Forbidden: Platform Admin privileges are required.');
    }

    let session = await AdminSession.findById(payload.sessionId);
    if (session) {
      if (session.revokedAt || session.expiresAt <= new Date()) {
        throw new HttpError(401, 'Admin session is invalid, revoked, or expired.');
      }
    } else if (env.useLocalEmbeddedDb || env.nodeEnv === 'development') {
      const fallbackAccount = await AdminCredential.findOne({
        $or: [{ _id: payload.sub }, { email: payload.email.toLowerCase() }],
        singletonKey: 'PLATFORM_ADMIN',
      });
      if (fallbackAccount) {
        // Auto-restore session in embedded/development mode when server reloaded
        session = await AdminSession.create({
          _id: payload.sessionId,
          adminId: fallbackAccount._id,
          refreshTokenHash: 'auto-restored',
          sourceApp: (req.get('x-client-platform') as any) || 'admin-web',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          lastUsedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }
    }

    if (!session) {
      throw new HttpError(401, 'Admin session is invalid, revoked, or expired.');
    }

    const adminAccount = await AdminCredential.findOne({
      $or: [{ _id: payload.sub }, { email: payload.email.toLowerCase() }],
      singletonKey: 'PLATFORM_ADMIN',
    }).select('_id email name');

    if (!adminAccount) {
      throw new HttpError(403, 'Forbidden: Platform Admin account not found.');
    }

    session.lastUsedAt = new Date();
    await session.save();

    req.admin = {
      id: adminAccount._id.toString(),
      email: adminAccount.email,
      name: adminAccount.name,
      sessionId: session._id.toString(),
    };

    next();
  } catch (error) {
    next(error);
  }
}

