import type {
  AdminDocumentRecord,
  AdminProfile,
  AdminSessionInfo,
  AdminUserDetail,
  AdminUserSummary,
  ApiResponse,
  AuditLogRecord,
  CategoryRecord,
  DashboardCharts,
  DashboardKPIs,
  NotificationBroadcastRecord,
  NotificationTemplateRecord,
  PaymentRecord,
  PlanRecord,
  PlatformSettingsRecord,
  StorageOverview,
  SubscriptionSummary,
  SupportTicketRecord,
} from '@docscanner/shared-types';
import { apiClient } from '../lib/apiClient';

export interface DashboardPayload {
  kpis: DashboardKPIs;
  alerts: {
    failedUploads: number;
    openTicketsCount: number;
    pendingDeletionsCount: number;
    pendingRecoveriesCount: number;
  };
  charts: DashboardCharts;
  recentRegistrations: AdminUserSummary[];
  recentActivities: AuditLogRecord[];
}

export const adminApi = {
  auth: {
    login: async (email: string, password: string) => {
      const res = await apiClient.post<
        ApiResponse<{ accessToken: string; refreshToken: string; admin: AdminProfile; sessionId: string }>
      >('/admin/auth/login', { email, password });
      return res.data.data;
    },
    forgotPassword: async (email: string) => {
      const res = await apiClient.post<ApiResponse<{ requested: boolean }>>('/admin/auth/forgot-password', { email });
      return res.data;
    },
    resetPassword: async (payload: { email: string; otp: string; newPassword: string }) => {
      const res = await apiClient.post<ApiResponse<{ reset: boolean }>>('/admin/auth/reset-password', payload);
      return res.data;
    },
    logout: async () => {
      await apiClient.post('/admin/auth/logout');
    },
    me: async () => {
      const res = await apiClient.get<ApiResponse<AdminProfile>>('/admin/auth/me');
      return res.data.data;
    },
    sessions: async () => {
      const res = await apiClient.get<ApiResponse<AdminSessionInfo[]>>('/admin/auth/sessions');
      return res.data.data;
    },
    revokeSession: async (sessionId: string) => {
      await apiClient.delete(`/admin/auth/sessions/${sessionId}`);
    },
  },

  dashboard: {
    getOverview: async (days = 30) => {
      const res = await apiClient.get<ApiResponse<DashboardPayload>>('/admin/dashboard', { params: { days } });
      return res.data.data;
    },
  },

  users: {
    list: async (params: { page?: number; limit?: number; search?: string; status?: string; requestType?: string }) => {
      const res = await apiClient.get<ApiResponse<AdminUserSummary[]>>('/admin/users', { params });
      return res.data;
    },
    getById: async (userId: string) => {
      const res = await apiClient.get<ApiResponse<AdminUserDetail>>(`/admin/users/${userId}`);
      return res.data.data;
    },
    updateStatus: async (userId: string, status: 'active' | 'suspended', reason?: string) => {
      const res = await apiClient.patch<ApiResponse<{ _id: string; status: string }>>(`/admin/users/${userId}/status`, {
        status,
        reason,
      });
      return res.data.data;
    },
    reviewRecovery: async (userId: string, decision: 'approved' | 'rejected', notes?: string) => {
      const res = await apiClient.post<ApiResponse<unknown>>(`/admin/users/${userId}/recovery`, { decision, notes });
      return res.data.data;
    },
    reviewDeletion: async (userId: string, decision: 'approved' | 'rejected', notes?: string) => {
      const res = await apiClient.post<ApiResponse<unknown>>(`/admin/users/${userId}/deletion-review`, {
        decision,
        notes,
      });
      return res.data.data;
    },
  },

  documents: {
    list: async (params: {
      page?: number;
      limit?: number;
      search?: string;
      userId?: string;
      categoryId?: string;
      status?: string;
    }) => {
      const res = await apiClient.get<ApiResponse<AdminDocumentRecord[]>>('/admin/documents', { params });
      return res.data;
    },
    failedUploads: async (params: { page?: number; limit?: number }) => {
      const res = await apiClient.get<ApiResponse<StorageOverview['uploadExceptions']>>('/admin/documents/failed-uploads', {
        params,
      });
      return res.data;
    },
    getById: async (documentId: string) => {
      const res = await apiClient.get<ApiResponse<AdminDocumentRecord>>(`/admin/documents/${documentId}`);
      return res.data.data;
    },
    getAccessUrl: async (documentId: string, payload: { mode: 'preview' | 'download'; fileIndex?: number; reason?: string }) => {
      const res = await apiClient.post<
        ApiResponse<{ url: string; expiresInSeconds: number; mimeType: string; filename: string }>
      >(`/admin/documents/${documentId}/access-url`, payload);
      return res.data.data;
    },
    resolveIssue: async (documentId: string, payload: { status?: 'available' | 'failed' | 'deleted'; operationalNotes: string }) => {
      const res = await apiClient.patch<ApiResponse<unknown>>(`/admin/documents/${documentId}/issue`, payload);
      return res.data.data;
    },
  },

  plans: {
    list: async () => {
      const res = await apiClient.get<ApiResponse<PlanRecord[]>>('/admin/plans');
      return res.data.data;
    },
    create: async (payload: Omit<PlanRecord, '_id' | 'createdAt' | 'updatedAt'>) => {
      const res = await apiClient.post<ApiResponse<PlanRecord>>('/admin/plans', payload);
      return res.data.data;
    },
    update: async (planId: string, payload: Partial<Omit<PlanRecord, '_id' | 'createdAt' | 'updatedAt'>>) => {
      const res = await apiClient.patch<ApiResponse<PlanRecord>>(`/admin/plans/${planId}`, payload);
      return res.data.data;
    },
    toggleStatus: async (planId: string, isActive: boolean) => {
      const res = await apiClient.patch<ApiResponse<PlanRecord>>(`/admin/plans/${planId}/status`, { isActive });
      return res.data.data;
    },
    delete: async (planId: string) => {
      const res = await apiClient.delete<ApiResponse<{ deleted: boolean; _id: string }>>(`/admin/plans/${planId}`);
      return res.data;
    },
    listSubscriptions: async (params: { page?: number; limit?: number; status?: string; renewal?: string }) => {
      const res = await apiClient.get<ApiResponse<SubscriptionSummary[]>>('/admin/subscriptions', { params });
      return res.data;
    },
  },

  payments: {
    list: async (params: { page?: number; limit?: number; status?: string; method?: string; search?: string }) => {
      const res = await apiClient.get<ApiResponse<PaymentRecord[]>>('/admin/payments', { params });
      return res.data;
    },
    refund: async (paymentId: string, payload: { amountInr?: number; reason: string }) => {
      const res = await apiClient.post<ApiResponse<unknown>>(`/admin/payments/${paymentId}/refund`, payload);
      return res.data.data;
    },
    exportCsv: async (params: { status?: string; method?: string; search?: string }) => {
      const res = await apiClient.get('/admin/payments/export', { params, responseType: 'blob' });
      return res.data as Blob;
    },
  },

  storage: {
    getOverview: async () => {
      const res = await apiClient.get<ApiResponse<StorageOverview>>('/admin/storage');
      return res.data.data;
    },
  },

  categories: {
    list: async () => {
      const res = await apiClient.get<ApiResponse<CategoryRecord[]>>('/admin/categories');
      return res.data.data;
    },
    create: async (payload: { name: string; description?: string; icon?: string; isActive: boolean }) => {
      const res = await apiClient.post<ApiResponse<CategoryRecord>>('/admin/categories', payload);
      return res.data.data;
    },
    update: async (categoryId: string, payload: Partial<{ name: string; description?: string; icon?: string; isActive: boolean }>) => {
      const res = await apiClient.patch<ApiResponse<CategoryRecord>>(`/admin/categories/${categoryId}`, payload);
      return res.data.data;
    },
    remove: async (categoryId: string) => {
      await apiClient.delete(`/admin/categories/${categoryId}`);
    },
  },

  notifications: {
    list: async (params: { page?: number; limit?: number }) => {
      const res = await apiClient.get<ApiResponse<NotificationBroadcastRecord[]>>('/admin/notifications', { params });
      return res.data;
    },
    create: async (payload: {
      title: string;
      body: string;
      channel: 'in_app' | 'push' | 'both';
      targetAudience: 'all' | 'selected';
      targetUserIds: string[];
      sendImmediately: boolean;
    }) => {
      const res = await apiClient.post<ApiResponse<NotificationBroadcastRecord>>('/admin/notifications', payload);
      return res.data.data;
    },
    update: async (id: string, payload: Partial<NotificationBroadcastRecord> & { sendImmediately?: boolean }) => {
      const res = await apiClient.patch<ApiResponse<NotificationBroadcastRecord>>(`/admin/notifications/${id}`, payload);
      return res.data.data;
    },
    sendExisting: async (id: string) => {
      const res = await apiClient.post<ApiResponse<NotificationBroadcastRecord>>(`/admin/notifications/${id}/send`);
      return res.data.data;
    },
    remove: async (id: string) => {
      await apiClient.delete(`/admin/notifications/${id}`);
    },
    listTemplates: async () => {
      const res = await apiClient.get<ApiResponse<NotificationTemplateRecord[]>>('/admin/notifications/templates');
      return res.data.data;
    },
    createTemplate: async (payload: { name: string; title: string; body: string; channel: 'in_app' | 'push' | 'both' }) => {
      const res = await apiClient.post<ApiResponse<NotificationTemplateRecord>>('/admin/notifications/templates', payload);
      return res.data.data;
    },
    deleteTemplate: async (templateId: string) => {
      await apiClient.delete(`/admin/notifications/templates/${templateId}`);
    },
  },

  support: {
    list: async (params: { page?: number; limit?: number; status?: string; priority?: string; search?: string }) => {
      const res = await apiClient.get<ApiResponse<SupportTicketRecord[]>>('/admin/support/tickets', { params });
      return res.data;
    },
    getById: async (ticketId: string) => {
      const res = await apiClient.get<ApiResponse<SupportTicketRecord>>(`/admin/support/tickets/${ticketId}`);
      return res.data.data;
    },
    update: async (
      ticketId: string,
      payload: Partial<{ priority: string; status: string; assignedTo: string; resolutionNotes: string }>
    ) => {
      const res = await apiClient.patch<ApiResponse<SupportTicketRecord>>(`/admin/support/tickets/${ticketId}`, payload);
      return res.data.data;
    },
    reply: async (ticketId: string, payload: { message: string; status?: string }) => {
      const res = await apiClient.post<ApiResponse<SupportTicketRecord>>(`/admin/support/tickets/${ticketId}/reply`, payload);
      return res.data.data;
    },
  },

  reports: {
    getReport: async (reportType: string, params: { from?: string; to?: string }) => {
      const res = await apiClient.get<
        ApiResponse<{ reportType: string; summary: Record<string, unknown>; rows: Array<Record<string, unknown>> }>
      >(`/admin/reports/${reportType}`, { params });
      return res.data.data;
    },
    exportCsv: async (reportType: string, params: { from?: string; to?: string }) => {
      const res = await apiClient.get(`/admin/reports/${reportType}`, {
        params: { ...params, format: 'csv' },
        responseType: 'blob',
      });
      return res.data as Blob;
    },
  },

  auditLogs: {
    list: async (params: {
      page?: number;
      limit?: number;
      action?: string;
      entityType?: string;
      sourceApp?: string;
      search?: string;
      from?: string;
      to?: string;
    }) => {
      const res = await apiClient.get<ApiResponse<AuditLogRecord[]>>('/admin/audit-logs', { params });
      return res.data;
    },
  },

  settings: {
    get: async () => {
      const res = await apiClient.get<ApiResponse<PlatformSettingsRecord>>('/admin/settings');
      return res.data.data;
    },
    update: async (payload: Partial<PlatformSettingsRecord>) => {
      const res = await apiClient.patch<ApiResponse<PlatformSettingsRecord>>('/admin/settings', payload);
      return res.data.data;
    },
  },
};

