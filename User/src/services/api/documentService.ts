import { apiClient } from './client';
import { API_CONFIG } from '../../constants';
import {
  DocumentItem,
  UploadAuthorisationResponse,
  StorageInfo,
  FolderItem,
  ExpiryReminder,
  SubscriptionPlan,
  UserSubscription,
  SupportTicket,
} from '../../types';

export const documentService = {
  async getDocuments(params?: {
    category?: string;
    folderId?: string;
    search?: string;
    fileType?: string;
    sortBy?: 'createdAt' | 'name' | 'fileSizeBytes';
    sortOrder?: 'asc' | 'desc';
    isFavourite?: boolean;
    isArchived?: boolean;
  }): Promise<{ documents: DocumentItem[]; total: number }> {
    const res = await apiClient.get<{ documents: DocumentItem[]; total: number }>(
      API_CONFIG.ENDPOINTS.DOCUMENTS,
      { params }
    );
    return res.data;
  },

  async getDocumentById(id: string): Promise<DocumentItem> {
    const res = await apiClient.get<{ document: DocumentItem }>(API_CONFIG.ENDPOINTS.DOCUMENT_BY_ID(id));
    return res.data.document;
  },

  async requestUploadAuth(data: {
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    category: string;
    tags?: string[];
    folderId?: string | null;
    notes?: string;
    expiryDate?: string;
  }): Promise<UploadAuthorisationResponse> {
    const res = await apiClient.post<UploadAuthorisationResponse>(
      API_CONFIG.ENDPOINTS.DOCUMENT_UPLOAD_AUTH,
      data
    );
    return res.data;
  },

  async confirmUpload(documentId: string, payload: { storageKey: string; checksum?: string }): Promise<DocumentItem> {
    const res = await apiClient.post<{ document: DocumentItem }>(
      API_CONFIG.ENDPOINTS.DOCUMENT_CONFIRM_UPLOAD(documentId),
      payload
    );
    return res.data.document;
  },

  async getDownloadUrl(id: string): Promise<{ downloadUrl: string; expiresInSeconds: number }> {
    const res = await apiClient.get<{ downloadUrl: string; expiresInSeconds: number }>(
      API_CONFIG.ENDPOINTS.DOCUMENT_DOWNLOAD(id)
    );
    return res.data;
  },

  async toggleFavourite(id: string, isFavourite: boolean): Promise<DocumentItem> {
    const res = await apiClient.patch<{ document: DocumentItem }>(
      API_CONFIG.ENDPOINTS.DOCUMENT_FAVOURITE(id),
      { isFavourite }
    );
    return res.data.document;
  },

  async archiveDocument(id: string): Promise<DocumentItem> {
    const res = await apiClient.patch<{ document: DocumentItem }>(API_CONFIG.ENDPOINTS.DOCUMENT_ARCHIVE(id));
    return res.data.document;
  },

  async restoreDocument(id: string): Promise<DocumentItem> {
    const res = await apiClient.patch<{ document: DocumentItem }>(API_CONFIG.ENDPOINTS.DOCUMENT_RESTORE(id));
    return res.data.document;
  },

  async deleteDocument(id: string): Promise<{ success: boolean }> {
    const res = await apiClient.delete<{ success: boolean }>(API_CONFIG.ENDPOINTS.DOCUMENT_BY_ID(id));
    return res.data;
  },

  async moveDocument(id: string, folderId: string | null): Promise<DocumentItem> {
    const res = await apiClient.patch<{ document: DocumentItem }>(API_CONFIG.ENDPOINTS.DOCUMENT_MOVE(id), {
      folderId,
    });
    return res.data.document;
  },

  async updateMetadata(
    id: string,
    data: { name?: string; category?: string; tags?: string[]; notes?: string; expiryDate?: string }
  ): Promise<DocumentItem> {
    const res = await apiClient.put<{ document: DocumentItem }>(API_CONFIG.ENDPOINTS.DOCUMENT_BY_ID(id), data);
    return res.data.document;
  },
};

export const folderService = {
  async getFolders(parentFolderId?: string | null): Promise<FolderItem[]> {
    const res = await apiClient.get<{ folders: FolderItem[] }>(API_CONFIG.ENDPOINTS.FOLDERS, {
      params: { parentFolderId },
    });
    return res.data.folders;
  },

  async createFolder(name: string, parentFolderId?: string | null, color?: string): Promise<FolderItem> {
    const res = await apiClient.post<{ folder: FolderItem }>(API_CONFIG.ENDPOINTS.FOLDERS, {
      name,
      parentFolderId,
      color,
    });
    return res.data.folder;
  },

  async renameFolder(id: string, name: string): Promise<FolderItem> {
    const res = await apiClient.put<{ folder: FolderItem }>(API_CONFIG.ENDPOINTS.FOLDER_BY_ID(id), { name });
    return res.data.folder;
  },

  async deleteFolder(id: string): Promise<{ success: boolean }> {
    const res = await apiClient.delete<{ success: boolean }>(API_CONFIG.ENDPOINTS.FOLDER_BY_ID(id));
    return res.data;
  },
};

export const storageService = {
  async getStorageInfo(): Promise<StorageInfo> {
    const res = await apiClient.get<{ storage: StorageInfo }>(API_CONFIG.ENDPOINTS.STORAGE_INFO);
    return res.data.storage;
  },
};

export const reminderService = {
  async getReminders(): Promise<ExpiryReminder[]> {
    const res = await apiClient.get<{ reminders: ExpiryReminder[] }>(API_CONFIG.ENDPOINTS.REMINDERS);
    return res.data.reminders;
  },

  async createReminder(data: {
    documentId: string;
    reminderDate: string;
    notes?: string;
  }): Promise<ExpiryReminder> {
    const res = await apiClient.post<{ reminder: ExpiryReminder }>(API_CONFIG.ENDPOINTS.REMINDERS, data);
    return res.data.reminder;
  },

  async deleteReminder(id: string): Promise<{ success: boolean }> {
    const res = await apiClient.delete<{ success: boolean }>(API_CONFIG.ENDPOINTS.REMINDER_BY_ID(id));
    return res.data;
  },
};

export const subscriptionService = {
  async getPlans(): Promise<SubscriptionPlan[]> {
    const res = await apiClient.get<{ plans: SubscriptionPlan[] }>(API_CONFIG.ENDPOINTS.PLANS);
    return res.data.plans;
  },

  async getCurrentSubscription(): Promise<UserSubscription | null> {
    const res = await apiClient.get<{ subscription: UserSubscription | null }>(
      API_CONFIG.ENDPOINTS.SUBSCRIPTION_CURRENT
    );
    return res.data.subscription;
  },

  async upgradePlan(planId: string, billingCycle: 'monthly' | 'annual'): Promise<{ success: boolean; redirectUrl?: string }> {
    const res = await apiClient.post(API_CONFIG.ENDPOINTS.SUBSCRIPTION_UPGRADE, { planId, billingCycle });
    return res.data;
  },
};

export const supportService = {
  async createTicket(data: { subject: string; category: string; description: string }): Promise<SupportTicket> {
    const res = await apiClient.post<{ ticket: SupportTicket }>(API_CONFIG.ENDPOINTS.SUPPORT_TICKETS, data);
    return res.data.ticket;
  },

  async getTickets(): Promise<SupportTicket[]> {
    const res = await apiClient.get<{ tickets: SupportTicket[] }>(API_CONFIG.ENDPOINTS.SUPPORT_TICKETS);
    return res.data.tickets;
  },
};

