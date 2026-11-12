export type ClientPlatform = 'admin-web' | 'admin-mobile';

export type UserAccountStatus = 'pending_verification' | 'active' | 'suspended' | 'deleted';

export type DocumentUploadStatus =
  | 'draft'
  | 'upload_pending'
  | 'uploading'
  | 'verifying'
  | 'available'
  | 'failed'
  | 'deleted';

export type BillingCycle = 'monthly' | 'annual';

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'grace_period';

export type PaymentStatus = 'created' | 'authorized' | 'captured' | 'failed' | 'refunded' | 'partially_refunded';

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: ApiMeta;
}

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: 'platform_admin';
  lastLoginAt?: string;
}

export interface AdminSessionInfo {
  id: string;
  sourceApp: ClientPlatform;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent?: boolean;
}

export interface DashboardKPIs {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalDocuments: number;
  totalStorageUsedBytes: number;
  totalStorageAvailableBytes: number;
  totalStorageCapacityBytes: number;
  totalUploads: number;
  successfulUploads: number;
  failedUploads: number;
  activeSubscriptions: number;
  totalRevenueInr: number;
}

export interface TimeSeriesPoint {
  date: string;
  label: string;
  value: number;
  secondaryValue?: number;
}

export interface BreakdownPoint {
  name: string;
  value: number;
  bytes?: number;
}

export interface DashboardCharts {
  userRegistrationGrowth: TimeSeriesPoint[];
  documentUploadStats: Array<{ date: string; successful: number; failed: number }>;
  storageUsageTrend: TimeSeriesPoint[];
  revenueOverview: TimeSeriesPoint[];
  subscriptionStats: BreakdownPoint[];
}

export interface AdminUserSummary {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  status: UserAccountStatus;
  registrationDate: string;
  storageUsedBytes: number;
  totalDocuments: number;
  planName?: string;
  subscriptionStatus?: SubscriptionStatus;
  recoveryRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  deletionRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
}

export interface AdminUserDetail extends AdminUserSummary {
  avatarUrl?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  lastActiveAt?: string;
  suspensionReason?: string;
  recoveryRequestNotes?: string;
  deletionRequestedAt?: string;
  deletionReason?: string;
  subscription?: SubscriptionSummary | null;
}

export interface DocumentFileEntry {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  pageCount?: number;
  originalFilename?: string;
}

export interface AdminDocumentRecord {
  _id: string;
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  name: string;
  documentType?: string;
  categoryId?: string;
  categoryName?: string;
  folderId?: string;
  tags: string[];
  files: DocumentFileEntry[];
  totalSizeBytes: number;
  status: DocumentUploadStatus;
  failureReason?: string;
  operationalNotes?: string;
  expiryDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanRecord {
  _id: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionSummary {
  _id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  planId: string;
  planName: string;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  startDate: string;
  endDate?: string;
  autoRenew: boolean;
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface PaymentRecord {
  _id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  subscriptionId?: string;
  planName?: string;
  provider: 'razorpay';
  providerOrderId?: string;
  providerPaymentId?: string;
  providerRefundId?: string;
  amountInr: number;
  currency: string;
  method?: string;
  status: PaymentStatus;
  webhookVerified: boolean;
  failureReason?: string;
  refundReason?: string;
  refundedAt?: string;
  paidAt?: string;
  createdAt: string;
}

export interface StorageOverview {
  totalCapacityBytes: number;
  totalUsedBytes: number;
  totalAvailableBytes: number;
  utilizationPercent: number;
  userWiseUsage: Array<{
    userId: string;
    fullName: string;
    email: string;
    planName: string;
    usedBytes: number;
    quotaBytes: number;
    documentCount: number;
  }>;
  planWiseUsage: Array<{
    planName: string;
    userCount: number;
    usedBytes: number;
    allocatedBytes: number;
  }>;
  storageGrowth: TimeSeriesPoint[];
  uploadExceptions: Array<{
    _id: string;
    userId: string;
    userEmail?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    failureCategory: string;
    failureMessage: string;
    createdAt: string;
  }>;
}

export interface CategoryRecord {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  isSystemDefault: boolean;
  documentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationTemplateRecord {
  _id: string;
  name: string;
  title: string;
  body: string;
  channel: 'in_app' | 'push' | 'both';
  createdAt: string;
  updatedAt: string;
}

export interface NotificationBroadcastRecord {
  _id: string;
  title: string;
  body: string;
  channel: 'in_app' | 'push' | 'both';
  targetAudience: 'all' | 'selected';
  targetUserIds: string[];
  recipientCount: number;
  status: 'draft' | 'sent' | 'failed';
  sentAt?: string;
  createdAt: string;
}

export interface SupportTicketReply {
  _id?: string;
  senderRole: 'user' | 'admin';
  senderName: string;
  message: string;
  createdAt: string;
}

export interface SupportTicketRecord {
  _id: string;
  ticketNumber: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  subject: string;
  description: string;
  category?: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  assignedTo?: string;
  resolutionNotes?: string;
  replies: SupportTicketReply[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  _id: string;
  actorId: string;
  actorEmail: string;
  sourceApp: ClientPlatform;
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface PlatformSettingsRecord {
  _id?: string;
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
  updatedAt?: string;
}

