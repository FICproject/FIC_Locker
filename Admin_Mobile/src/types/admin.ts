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

export interface DashboardPayload {
  kpis: {
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
  };
  alerts: {
    failedUploads: number;
    openTicketsCount: number;
    pendingDeletionsCount: number;
    pendingRecoveriesCount: number;
  };
  recentRegistrations: AdminUserSummary[];
  recentActivities: AuditLogRecord[];
}

export interface AdminUserSummary {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  status: 'pending_verification' | 'active' | 'suspended' | 'deleted';
  registrationDate: string;
  storageUsedBytes: number;
  totalDocuments: number;
  planName?: string;
  subscriptionStatus?: string;
  recoveryRequestStatus?: string;
  deletionRequestStatus?: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  lastActiveAt?: string;
  suspensionReason?: string;
  subscription?: {
    planName: string;
    billingCycle: string;
    status: string;
    endDate?: string;
  } | null;
}

export interface AdminDocumentRecord {
  _id: string;
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  name: string;
  documentType?: string;
  categoryName?: string;
  tags: string[];
  files: Array<{
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    pageCount?: number;
    originalFilename?: string;
  }>;
  totalSizeBytes: number;
  status: string;
  failureReason?: string;
  operationalNotes?: string;
  createdAt: string;
}

export interface UploadExceptionRecord {
  _id: string;
  userId: string;
  userEmail?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  failureCategory: string;
  failureMessage: string;
  createdAt: string;
}

export interface SubscriptionRecord {
  _id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  planName: string;
  billingCycle: string;
  status: string;
  startDate: string;
  endDate?: string;
  autoRenew: boolean;
}

export interface PaymentRecord {
  _id: string;
  userName?: string;
  userEmail?: string;
  planName?: string;
  providerPaymentId?: string;
  providerOrderId?: string;
  amountInr: number;
  method?: string;
  status: string;
  webhookVerified: boolean;
  createdAt: string;
}

export interface StorageOverview {
  totalCapacityBytes: number;
  totalUsedBytes: number;
  totalAvailableBytes: number;
  utilizationPercent: number;
  planWiseUsage: Array<{
    planName: string;
    userCount: number;
    usedBytes: number;
    allocatedBytes: number;
  }>;
  uploadExceptions: UploadExceptionRecord[];
}

export interface SupportTicketRecord {
  _id: string;
  ticketNumber: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  resolutionNotes?: string;
  replies: Array<{
    _id?: string;
    senderRole: 'user' | 'admin';
    senderName: string;
    message: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationBroadcastRecord {
  _id: string;
  title: string;
  body: string;
  channel: 'in_app' | 'push' | 'both';
  targetAudience: 'all' | 'selected';
  recipientCount: number;
  status: 'draft' | 'sent' | 'failed';
  sentAt?: string;
  createdAt: string;
}

export interface AuditLogRecord {
  _id: string;
  actorEmail: string;
  sourceApp: 'admin-web' | 'admin-mobile';
  action: string;
  entityType: string;
  entityId?: string;
  summary: string;
  createdAt: string;
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
