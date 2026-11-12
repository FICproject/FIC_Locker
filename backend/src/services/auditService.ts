import { Request } from 'express';
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog';
import { adminEventBus } from './adminEventBus';

export type SourceApp = 'admin-web' | 'admin-mobile';

export function resolveSourceApp(req: Request): SourceApp {
  const header = String(req.headers['x-client-platform'] || '').toLowerCase();
  return header === 'admin-mobile' ? 'admin-mobile' : 'admin-web';
}

export interface RecordAuditInput {
  actorId: mongoose.Types.ObjectId | string;
  actorEmail: string;
  sourceApp: SourceApp;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function recordAuditLog(input: RecordAuditInput): Promise<void> {
  await AuditLog.create({
    actorId: input.actorId,
    actorEmail: input.actorEmail,
    sourceApp: input.sourceApp,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary,
    metadata: input.metadata,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  adminEventBus.emitChange({
    entityType: input.entityType,
    action: input.action,
    entityId: input.entityId,
    sourceApp: input.sourceApp,
  });
}

