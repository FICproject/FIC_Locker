export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended' | 'pending';
  storageQuotaBytes: number;
  storageUsedBytes: number;
  planId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface AuthResponse {
  user: UserProfile;
  tokens: AuthTokens;
}

export type DocumentCategoryType = 
  | 'Personal Documents'
  | 'Identity Proof'
  | 'Education Documents'
  | 'Financial Documents'
  | 'Medical Documents'
  | 'Other Documents';

export interface DocumentItem {
  _id: string;
  userId: string;
  name: string;
  originalFileName: string;
  fileType: 'pdf' | 'jpg' | 'jpeg' | 'png' | 'other';
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  downloadUrl?: string;
  category: DocumentCategoryType | string;
  folderId?: string | null;
  tags: string[];
  notes?: string;
  expiryDate?: string;
  isFavourite?: boolean;
  isArchived?: boolean;
  status: 'pending' | 'uploading' | 'verifying' | 'available' | 'failed';
  pageCount?: number;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FolderItem {
  _id: string;
  userId: string;
  name: string;
  parentFolderId?: string | null;
  documentCount?: number;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorageInfo {
  planName: string;
  quotaBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercentage: number;
  documentCount: number;
  failedUploadCount: number;
}

export interface ExpiryReminder {
  _id: string;
  documentId: string;
  documentName: string;
  category: string;
  expiryDate: string;
  reminderDate: string;
  daysRemaining: number;
  isRead?: boolean;
}

export interface SubscriptionPlan {
  _id: string;
  name: string;
  code: 'free' | 'pro' | 'enterprise';
  priceMonthly: number;
  priceAnnually: number;
  currency: string;
  storageQuotaBytes: number;
  features: string[];
  isPopular?: boolean;
}

export interface UserSubscription {
  planId: string;
  planName: string;
  billingCycle: 'monthly' | 'annual';
  status: 'active' | 'cancelled' | 'past_due';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface SupportTicket {
  _id: string;
  userId: string;
  subject: string;
  category: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  responses?: Array<{
    _id: string;
    sender: 'user' | 'support';
    message: string;
    createdAt: string;
  }>;
}

export interface UploadAuthorisationResponse {
  uploadUrl: string;
  storageKey: string;
  documentId: string;
  headers?: Record<string, string>;
  expiresInSeconds: number;
}

