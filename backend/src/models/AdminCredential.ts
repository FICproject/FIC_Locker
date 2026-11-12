import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminCredential extends Document {
  singletonKey: 'PLATFORM_ADMIN';
  email: string;
  name: string;
  passwordHash: string;
  resetOtpHash?: string | null;
  resetOtpExpiresAt?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AdminCredentialSchema = new Schema<IAdminCredential>(
  {
    singletonKey: {
      type: String,
      enum: ['PLATFORM_ADMIN'],
      default: 'PLATFORM_ADMIN',
      unique: true,
      immutable: true,
      required: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    resetOtpHash: { type: String, default: null },
    resetOtpExpiresAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { collection: 'admin_credentials', timestamps: true }
);

export const AdminCredential = mongoose.model<IAdminCredential>('AdminCredential', AdminCredentialSchema);

export interface IAdminSession extends Document {
  adminId: mongoose.Types.ObjectId;
  refreshTokenHash: string;
  sourceApp: 'admin-web' | 'admin-mobile';
  ipAddress?: string;
  userAgent?: string;
  revokedAt?: Date | null;
  lastUsedAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

const AdminSessionSchema = new Schema<IAdminSession>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'AdminCredential', required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    sourceApp: { type: String, enum: ['admin-web', 'admin-mobile'], default: 'admin-web' },
    ipAddress: { type: String },
    userAgent: { type: String },
    revokedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
  },
  { collection: 'admin_sessions', timestamps: true }
);

export const AdminSession = mongoose.model<IAdminSession>('AdminSession', AdminSessionSchema);

