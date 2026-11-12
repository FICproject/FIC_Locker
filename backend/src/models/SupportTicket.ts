import mongoose, { Schema, Document } from 'mongoose';

export interface ISupportTicketReply {
  senderRole: 'user' | 'admin';
  senderName: string;
  message: string;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  ticketNumber: string;
  userId: mongoose.Types.ObjectId;
  subject: string;
  description: string;
  category?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  resolutionNotes?: string;
  replies: ISupportTicketReply[];
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketReplySchema = new Schema<ISupportTicketReply>(
  {
    senderRole: { type: String, enum: ['user', 'admin'], required: true },
    senderName: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, default: 'general' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium', index: true },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    assignedTo: { type: String, default: 'Platform Admin' },
    resolutionNotes: { type: String },
    replies: { type: [SupportTicketReplySchema], default: [] },
  },
  { collection: 'support_tickets', timestamps: true }
);

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);

