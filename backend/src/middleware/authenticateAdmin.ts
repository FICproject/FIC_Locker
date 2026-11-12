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

    const session = await AdminSession.findOne({
      _id: payload.sessionId,
      adminId: payload.sub,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      throw new HttpError(401, 'Admin session is invalid, revoked, or expired.');
    }

    const adminAccount = await AdminCredential.findOne({
      _id: payload.sub,
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

