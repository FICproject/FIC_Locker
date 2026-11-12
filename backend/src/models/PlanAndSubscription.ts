import mongoose, { Schema, Document } from 'mongoose';

export interface IPlan extends Document {
  name: string;
  code: string;
  description?: string;
  monthlyPriceInr: number;
  annualPriceInr: number;
  storageLimitBytes: number;
  maxFileSizeBytes: number;
  documentLimit: number | null;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, required: true, lowercase: true, trim: true, unique: true },
    description: { type: String, trim: true },
    monthlyPriceInr: { type: Number, required: true, min: 0 },
    annualPriceInr: { type: Number, required: true, min: 0 },
    storageLimitBytes: { type: Number, required: true, min: 0 },
    maxFileSizeBytes: { type: Number, required: true, min: 1 },
    documentLimit: { type: Number, default: null },
    features: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
  },
  { collection: 'plans', timestamps: true }
);

export const Plan = mongoose.model<IPlan>('Plan', PlanSchema);

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  billingCycle: 'monthly' | 'annual';
  status: 'active' | 'expired' | 'cancelled' | 'grace_period';
  startDate: Date;
  endDate?: Date | null;
  autoRenew: boolean;
  providerSubscriptionId?: string;
  cancelledAt?: Date | null;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    billingCycle: { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'grace_period'],
      default: 'active',
      index: true,
    },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, default: null },
    autoRenew: { type: Boolean, default: true },
    providerSubscriptionId: { type: String },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String },
  },
  { collection: 'subscriptions', timestamps: true }
);

SubscriptionSchema.index({ userId: 1, status: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

