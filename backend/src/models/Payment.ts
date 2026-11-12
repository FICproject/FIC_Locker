import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId | null;
  planId?: mongoose.Types.ObjectId | null;
  provider: 'razorpay';
  providerOrderId?: string;
  providerPaymentId?: string;
  providerRefundId?: string;
  amountInr: number;
  currency: string;
  method?: string;
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded' | 'partially_refunded';
  webhookVerified: boolean;
  webhookEventIds: string[];
  failureReason?: string;
  refundReason?: string;
  refundedAt?: Date | null;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', default: null },
    provider: { type: String, enum: ['razorpay'], default: 'razorpay' },
    providerOrderId: { type: String, index: true },
    providerPaymentId: { type: String, index: true },
    providerRefundId: { type: String },
    amountInr: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    method: { type: String },
    status: {
      type: String,
      enum: ['created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded'],
      default: 'created',
      index: true,
    },
    webhookVerified: { type: Boolean, default: false },
    webhookEventIds: { type: [String], default: [] },
    failureReason: { type: String },
    refundReason: { type: String },
    refundedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { collection: 'payments', timestamps: true }
);

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);

