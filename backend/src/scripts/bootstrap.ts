import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { AdminCredential } from '../models/AdminCredential';
import { PlatformSettings } from '../models/PlatformSettings';
import { DocumentCategory } from '../models/Category';
import { Plan } from '../models/PlanAndSubscription';
import { User } from '../models/User';

export const FIXED_ADMIN_ID = new mongoose.Types.ObjectId('6af600000000000000000001');
export const DEFAULT_USER_ID = new mongoose.Types.ObjectId('6af600000000000000000002');

const DEFAULT_CATEGORIES = [
  { name: 'Personal Documents', slug: 'personal-documents', description: 'Personal records and certificates', icon: 'user' },
  { name: 'Identity Proof', slug: 'identity-proof', description: 'ID cards, passports, and driving licenses', icon: 'id-card' },
  { name: 'Education Documents', slug: 'education-documents', description: 'Marksheets, degrees, and transcripts', icon: 'graduation-cap' },
  { name: 'Financial Documents', slug: 'financial-documents', description: 'Bank statements, tax returns, and invoices', icon: 'wallet' },
  { name: 'Medical Documents', slug: 'medical-documents', description: 'Prescriptions, lab reports, and insurance', icon: 'heart-pulse' },
  { name: 'Other Documents', slug: 'other-documents', description: 'General uncategorised documents', icon: 'folder' },
];

const DEFAULT_PLANS = [
  {
    name: 'Free',
    code: 'free',
    description: 'Starter plan for individual document scanning and cloud backup',
    monthlyPriceInr: 0,
    annualPriceInr: 0,
    storageLimitBytes: 500 * 1024 * 1024, // 500 MB
    maxFileSizeBytes: 10 * 1024 * 1024, // 10 MB
    documentLimit: 100,
    features: ['Camera scanning', 'Multi-page PDF creation', 'Manual categories & folders', '500 MB cloud storage'],
    isActive: true,
  },
  {
    name: 'Plus',
    code: 'plus',
    description: 'Expanded cloud storage for personal archives',
    monthlyPriceInr: 149,
    annualPriceInr: 1499,
    storageLimitBytes: 10 * 1024 * 1024 * 1024, // 10 GB
    maxFileSizeBytes: 25 * 1024 * 1024, // 25 MB
    documentLimit: 2500,
    features: ['10 GB cloud storage', 'Up to 25 MB per upload', 'Expiry reminders', 'Priority email support'],
    isActive: true,
  },
  {
    name: 'Premium',
    code: 'premium',
    description: 'High-capacity individual storage and maximum upload limits',
    monthlyPriceInr: 399,
    annualPriceInr: 3999,
    storageLimitBytes: 50 * 1024 * 1024 * 1024, // 50 GB
    maxFileSizeBytes: 50 * 1024 * 1024, // 50 MB
    documentLimit: null,
    features: ['50 GB cloud storage', 'Unlimited documents', 'Up to 50 MB per upload', 'Priority support'],
    isActive: true,
  },
];

export async function ensureBaselineSeed(): Promise<void> {
  const existingAdmin = await AdminCredential.findOne({ singletonKey: 'PLATFORM_ADMIN' });
  const passwordHash = await bcrypt.hash(env.adminPassword, 12);
  if (!existingAdmin) {
    await AdminCredential.create({
      _id: FIXED_ADMIN_ID,
      singletonKey: 'PLATFORM_ADMIN',
      email: env.adminEmail.toLowerCase(),
      name: env.adminName,
      passwordHash,
    });
    console.info(`[Bootstrap] Seeded single Platform Admin account (${env.adminEmail}).`);
  } else {
    existingAdmin.email = env.adminEmail.toLowerCase();
    existingAdmin.name = env.adminName;
    existingAdmin.passwordHash = passwordHash;
    await existingAdmin.save();
    console.info(`[Bootstrap] Updated Platform Admin account (${env.adminEmail}).`);
  }

  const existingSettings = await PlatformSettings.findOne({ singletonKey: 'PLATFORM_SETTINGS' });
  if (!existingSettings) {
    await PlatformSettings.create({ singletonKey: 'PLATFORM_SETTINGS' });
  }

  const categoryCount = await DocumentCategory.countDocuments({});
  if (categoryCount === 0) {
    await DocumentCategory.insertMany(
      DEFAULT_CATEGORIES.map((c) => ({ ...c, isActive: true, isSystemDefault: true }))
    );
  }

  const planCount = await Plan.countDocuments({});
  if (planCount === 0) {
    await Plan.insertMany(DEFAULT_PLANS);
  }

  const userCount = await User.countDocuments({});
  if (userCount === 0) {
    await User.create({
      _id: DEFAULT_USER_ID,
      fullName: 'Dhanu Sri',
      email: 'dhanu.sri@gmail.com',
      status: 'active',
      isEmailVerified: true,
      storageUsedBytes: 0,
      totalDocuments: 0,
    });
    console.info('[Bootstrap] Seeded default user (Dhanu Sri).');
  }
}

