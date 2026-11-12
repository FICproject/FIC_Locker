import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  fullName: string;
  email: string;
  phone?: string;
  passwordHash?: string;
  avatarUrl?: string;
  status: 'pending_verification' | 'active' | 'suspended' | 'deleted';
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  fcmTokens: string[];
  storageUsedBytes: number;
  totalDocuments: number;
  currentPlanId?: mongoose.Types.ObjectId | null;
  suspensionReason?: string;
  recoveryRequestStatus: 'none' | 'pending' | 'approved' | 'rejected';
  recoveryRequestNotes?: string;
  deletionRequestStatus: 'none' | 'pending' | 'approved' | 'rejected';
  deletionRequestedAt?: Date | null;
  deletionReason?: string;
  lastActiveAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    phone: { type: String, trim: true, index: true },
    passwordHash: { type: String },
    avatarUrl: { type: String },
    status: {
      type: String,
      enum: ['pending_verification', 'active', 'suspended', 'deleted'],
      default: 'active',
      index: true,
    },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    fcmTokens: { type: [String], default: [] },
    storageUsedBytes: { type: Number, default: 0 },
    totalDocuments: { type: Number, default: 0 },
    currentPlanId: { type: Schema.Types.ObjectId, ref: 'Plan', default: null },
    suspensionReason: { type: String },
    recoveryRequestStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    recoveryRequestNotes: { type: String },
    deletionRequestStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    deletionRequestedAt: { type: Date, default: null },
    deletionReason: { type: String },
    lastActiveAt: { type: Date, default: null },
  },
  { collection: 'users', timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);

