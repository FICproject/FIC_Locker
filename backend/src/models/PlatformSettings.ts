import mongoose, { Schema, Document } from 'mongoose';

export interface IPlatformSettings extends Document {
  singletonKey: 'PLATFORM_SETTINGS';
  applicationName: string;
  maxUploadSizeBytes: number;
  allowedFileFormats: string[];
  totalCloudStorageLimitBytes: number;
  defaultFreeStorageBytes: number;
  documentRetentionDays: number;
  notificationSettings: {
    pushEnabled: boolean;
    inAppEnabled: boolean;
    emailResetEnabled: boolean;
  };
  featureFlags: {
    maintenanceMode: boolean;
    allowNewRegistrations: boolean;
    subscriptionsEnabled: boolean;
    supportTicketsEnabled: boolean;
  };
  updatedAt: Date;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    singletonKey: {
      type: String,
      enum: ['PLATFORM_SETTINGS'],
      default: 'PLATFORM_SETTINGS',
      unique: true,
      immutable: true,
    },
    applicationName: { type: String, default: 'DocScanner Cloud' },
    maxUploadSizeBytes: { type: Number, default: 25 * 1024 * 1024 },
    allowedFileFormats: { type: [String], default: ['application/pdf', 'image/jpeg', 'image/png'] },
    totalCloudStorageLimitBytes: { type: Number, default: 1024 * 1024 * 1024 * 1024 }, // 1 TB default
    defaultFreeStorageBytes: { type: Number, default: 500 * 1024 * 1024 }, // 500 MB
    documentRetentionDays: { type: Number, default: 30 },
    notificationSettings: {
      pushEnabled: { type: Boolean, default: true },
      inAppEnabled: { type: Boolean, default: true },
      emailResetEnabled: { type: Boolean, default: true },
    },
    featureFlags: {
      maintenanceMode: { type: Boolean, default: false },
      allowNewRegistrations: { type: Boolean, default: true },
      subscriptionsEnabled: { type: Boolean, default: true },
      supportTicketsEnabled: { type: Boolean, default: true },
    },
  },
  { collection: 'platform_settings', timestamps: true }
);

export const PlatformSettings = mongoose.model<IPlatformSettings>('PlatformSettings', PlatformSettingsSchema);

