import mongoose, { Schema, Document } from 'mongoose';

export interface INotificationTemplate extends Document {
  name: string;
  title: string;
  body: string;
  channel: 'in_app' | 'push' | 'both';
  createdAt: Date;
  updatedAt: Date;
}

const NotificationTemplateSchema = new Schema<INotificationTemplate>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    channel: { type: String, enum: ['in_app', 'push', 'both'], default: 'both' },
  },
  { collection: 'notification_templates', timestamps: true }
);

export const NotificationTemplate = mongoose.model<INotificationTemplate>(
  'NotificationTemplate',
  NotificationTemplateSchema
);

export interface INotificationBroadcast extends Document {
  title: string;
  body: string;
  channel: 'in_app' | 'push' | 'both';
  targetAudience: 'all' | 'selected';
  targetUserIds: mongoose.Types.ObjectId[];
  recipientCount: number;
  status: 'draft' | 'sent' | 'failed';
  sentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationBroadcastSchema = new Schema<INotificationBroadcast>(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    channel: { type: String, enum: ['in_app', 'push', 'both'], default: 'both' },
    targetAudience: { type: String, enum: ['all', 'selected'], default: 'all' },
    targetUserIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    recipientCount: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'sent', 'failed'], default: 'draft', index: true },
    sentAt: { type: Date, default: null },
  },
  { collection: 'notification_broadcasts', timestamps: true }
);

export const NotificationBroadcast = mongoose.model<INotificationBroadcast>(
  'NotificationBroadcast',
  NotificationBroadcastSchema
);

export interface IUserNotification extends Document {
  userId: mongoose.Types.ObjectId;
  broadcastId?: mongoose.Types.ObjectId | null;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date;
}

const UserNotificationSchema = new Schema<IUserNotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    broadcastId: { type: Schema.Types.ObjectId, ref: 'NotificationBroadcast', default: null },
    title: { type: String, required: true },
    body: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { collection: 'notifications', timestamps: true }
);

export const UserNotification = mongoose.model<IUserNotification>('UserNotification', UserNotificationSchema);

