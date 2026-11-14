import { mobileApiClient } from './apiClient';
import type {
  AdminDocumentRecord,
  AdminProfile,
  AdminUserDetail,
  AdminUserSummary,
  ApiResponse,
  AuditLogRecord,
  DashboardPayload,
  NotificationBroadcastRecord,
  PaymentRecord,
  PlanRecord,
  StorageOverview,
  SubscriptionRecord,
  SupportTicketRecord,
  UploadExceptionRecord,
} from '../types/admin';

export const adminMobileApi = {
  auth: {
    login: async (email: string, password: string) => {
      const res = await mobileApiClient.post<
        ApiResponse<{ accessToken: string; refreshToken: string; admin: AdminProfile }>
      >('/admin/auth/login', { email, password });
      return res.data.data;
    },
    forgotPassword: async (email: string) => {
      const res = await mobileApiClient.post<ApiResponse<{ requested: boolean }>>('/admin/auth/forgot-password', {
        email,
      });
      return res.data;
    },
    resetPassword: async (payload: { email: string; otp: string; newPassword: string }) => {
      const res = await mobileApiClient.post<ApiResponse<{ reset: boolean }>>('/admin/auth/reset-password', payload);
      return res.data;
    },
    me: async () => {
      const res = await mobileApiClient.get<ApiResponse<AdminProfile>>('/admin/auth/me');
      return res.data.data;
    },
    logout: async () => {
      await mobileApiClient.post('/admin/auth/logout');
    },
  },

  dashboard: {
    getOverview: async () => {
      const res = await mobileApiClient.get<ApiResponse<DashboardPayload>>('/admin/dashboard');
      return res.data.data;
    },
  },

  users: {
    list: async (params: { search?: string; status?: string; page?: number }) => {
      const res = await mobileApiClient.get<ApiResponse<AdminUserSummary[]>>('/admin/users', {
        params: { ...params, limit: 25 },
      });
      return res.data.data;
    },
    getById: async (userId: string) => {
      const res = await mobileApiClient.get<ApiResponse<AdminUserDetail>>(`/admin/users/${userId}`);
      return res.data.data;
    },
    updateStatus: async (userId: string, status: 'active' | 'suspended', reason?: string) => {
      const res = await mobileApiClient.patch<ApiResponse<{ status: string }>>(`/admin/users/${userId}/status`, {
        status,
        reason,
      });
      return res.data.data;
    },
  },

  documents: {
    list: async (params: { search?: string; status?: string }) => {
      const res = await mobileApiClient.get<ApiResponse<AdminDocumentRecord[]>>('/admin/documents', {
        params: { ...params, limit: 25 },
      });
      return res.data.data;
    },
    failedUploads: async () => {
      const res = await mobileApiClient.get<ApiResponse<UploadExceptionRecord[]>>('/admin/documents/failed-uploads', {
        params: { limit: 25 },
      });
      return res.data.data;
    },
    getById: async (documentId: string) => {
      const res = await mobileApiClient.get<ApiResponse<AdminDocumentRecord>>(`/admin/documents/${documentId}`);
      return res.data.data;
    },
    getAccessUrl: async (documentId: string, mode: 'preview' | 'download') => {
      const res = await mobileApiClient.post<ApiResponse<{ url: string; expiresInSeconds: number }>>(
        `/admin/documents/${documentId}/access-url`,
        { mode, fileIndex: 0, reason: `Admin mobile ${mode}` }
      );
      return res.data.data;
    },
    resolveIssue: async (documentId: string, status: 'available' | 'failed' | 'deleted', operationalNotes: string) => {
      await mobileApiClient.patch(`/admin/documents/${documentId}/issue`, { status, operationalNotes });
    },
  },

  monitoring: {
    subscriptions: async (status?: string) => {
      const res = await mobileApiClient.get<ApiResponse<SubscriptionRecord[]>>('/admin/subscriptions', {
        params: { status, limit: 30 },
      });
      return res.data.data;
    },
    payments: async (status?: string) => {
      const res = await mobileApiClient.get<ApiResponse<PaymentRecord[]>>('/admin/payments', {
        params: { status, limit: 30 },
      });
      return res.data.data;
    },
    storage: async () => {
      const res = await mobileApiClient.get<ApiResponse<StorageOverview>>('/admin/storage');
      return res.data.data;
    },
  },

  plans: {
    list: async () => {
      const res = await mobileApiClient.get<ApiResponse<PlanRecord[]>>('/admin/plans');
      return res.data.data;
    },
    toggleStatus: async (planId: string, isActive: boolean) => {
      const res = await mobileApiClient.patch<ApiResponse<PlanRecord>>(`/admin/plans/${planId}/status`, { isActive });
      return res.data.data;
    },
    delete: async (planId: string) => {
      const res = await mobileApiClient.delete<ApiResponse<{ deleted: boolean; _id: string }>>(`/admin/plans/${planId}`);
      return res.data;
    },
  },

  support: {
    list: async (params: { status?: string; search?: string }) => {
      const res = await mobileApiClient.get<ApiResponse<SupportTicketRecord[]>>('/admin/support/tickets', {
        params: { ...params, limit: 30 },
      });
      return res.data.data;
    },
    getById: async (ticketId: string) => {
      const res = await mobileApiClient.get<ApiResponse<SupportTicketRecord>>(`/admin/support/tickets/${ticketId}`);
      return res.data.data;
    },
    update: async (
      ticketId: string,
      payload: Partial<{ priority: string; status: string; assignedTo: string; resolutionNotes: string }>
    ) => {
      const res = await mobileApiClient.patch<ApiResponse<SupportTicketRecord>>(
        `/admin/support/tickets/${ticketId}`,
        payload
      );
      return res.data.data;
    },
    reply: async (ticketId: string, message: string, status?: string) => {
      const res = await mobileApiClient.post<ApiResponse<SupportTicketRecord>>(
        `/admin/support/tickets/${ticketId}/reply`,
        { message, status }
      );
      return res.data.data;
    },
  },

  notifications: {
    list: async () => {
      const res = await mobileApiClient.get<ApiResponse<NotificationBroadcastRecord[]>>('/admin/notifications', {
        params: { limit: 30 },
      });
      return res.data.data;
    },
    sendAnnouncement: async (title: string, body: string, channel: 'in_app' | 'push' | 'both') => {
      const res = await mobileApiClient.post<ApiResponse<NotificationBroadcastRecord>>('/admin/notifications', {
        title,
        body,
        channel,
        targetAudience: 'all',
        targetUserIds: [],
        sendImmediately: true,
      });
      return res.data.data;
    },
  },

  auditLogs: {
    list: async (sourceApp?: string) => {
      const res = await mobileApiClient.get<ApiResponse<AuditLogRecord[]>>('/admin/audit-logs', {
        params: { sourceApp, limit: 40 },
      });
      return res.data.data;
    },
  },
};
