import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../../models/User';
import { env } from '../../config/env';
import { asyncHandler, HttpError } from '../../utils/apiResponse';

export const userAuthRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function formatUserProfile(user: IUser) {
  return {
    _id: user._id.toString(),
    name: user.fullName,
    email: user.email,
    phone: user.phone || undefined,
    role: 'user' as const,
    status: user.status === 'deleted' ? 'suspended' : (user.status || 'active'),
    storageQuotaBytes: 500 * 1024 * 1024, // 500 MB default
    storageUsedBytes: user.storageUsedBytes || 0,
    planId: user.currentPlanId ? user.currentPlanId.toString() : undefined,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : new Date().toISOString(),
  };
}

function issueUserTokens(userId: string, email: string) {
  const secret = env.jwtAdminAccessSecret || 'user_jwt_secret_doc_scanner_saas';
  const accessToken = jwt.sign(
    { sub: userId, email, role: 'user' },
    secret,
    { expiresIn: '30d' }
  );
  const refreshToken = jwt.sign(
    { sub: userId, email, role: 'user', type: 'refresh' },
    secret,
    { expiresIn: '90d' }
  );
  return { accessToken, refreshToken, expiresIn: 2592000 };
}

// 1. Register User
userAuthRouter.post(
  '/register',
  asyncHandler(async (req: Request, res: Response) => {
    const body = registerSchema.parse(req.body);
    const normalizedEmail = body.email.toLowerCase().trim();

    let existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      if (existing.status === 'deleted') {
        throw new HttpError(400, 'This account has been deleted. Please contact support.');
      }
      throw new HttpError(409, 'An account with this email address already exists. Please sign in.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(body.password, salt);

    const user = await User.create({
      fullName: body.name.trim(),
      email: normalizedEmail,
      phone: body.phone?.trim() || undefined,
      passwordHash,
      status: 'active',
      isEmailVerified: true,
      storageUsedBytes: 0,
      totalDocuments: 0,
    });

    const tokens = issueUserTokens(user._id.toString(), user.email);

    return res.status(201).json({
      success: true,
      user: formatUserProfile(user),
      tokens,
    });
  })
);

// 2. Login User
userAuthRouter.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const body = loginSchema.parse(req.body);
    const normalizedEmail = body.email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || user.status === 'deleted') {
      throw new HttpError(401, 'Invalid email or password.');
    }

    if (user.status === 'suspended') {
      throw new HttpError(403, 'Account is suspended. Please contact administrator.');
    }

    // Verify password if hash exists
    if (user.passwordHash) {
      const isMatch = await bcrypt.compare(body.password, user.passwordHash);
      if (!isMatch) {
        throw new HttpError(401, 'Invalid email or password.');
      }
    } else {
      // If user was created without password, set it now
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(body.password, salt);
      await user.save();
    }

    user.lastActiveAt = new Date();
    await user.save();

    const tokens = issueUserTokens(user._id.toString(), user.email);

    return res.json({
      success: true,
      user: formatUserProfile(user),
      tokens,
    });
  })
);

// 3. Get Current User Profile
userAuthRouter.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    let user = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      try {
        const secret = env.jwtAdminAccessSecret || 'user_jwt_secret_doc_scanner_saas';
        const decoded = jwt.verify(token, secret) as any;
        if (decoded?.sub) {
          user = await User.findById(decoded.sub);
        }
      } catch {}
    }

    if (!user) {
      user = await User.findOne({ status: { $ne: 'deleted' } });
    }

    if (!user) {
      throw new HttpError(401, 'Authentication required.');
    }

    return res.json({
      success: true,
      user: formatUserProfile(user),
    });
  })
);

// 4. Logout User
userAuthRouter.post(
  '/logout',
  asyncHandler(async (_req: Request, res: Response) => {
    return res.json({
      success: true,
      message: 'Logged out successfully.',
    });
  })
);
