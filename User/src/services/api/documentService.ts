import axios from 'axios';
import { apiClient } from './client';
import { API_CONFIG, resolveDevHost, setApiHostOverride } from '../../constants';
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
    try {
      const res = await apiClient.get<any>(API_CONFIG.ENDPOINTS.PLANS);
      const raw = res.data?.data?.plans ?? res.data?.plans ?? res.data?.data ?? res.data ?? [];
      if (Array.isArray(raw) && raw.length > 0) {
        return raw;
      }
    } catch (err) {
      console.warn('[subscriptionService] Primary getPlans via apiClient failed:', err);
    }

    // Fallback host scan for Android physical device / WiFi LAN / emulator / USB adb
    const candidateHosts = [
      resolveDevHost(),
      '192.168.0.139',
      '10.0.2.2',
      'localhost',
      '127.0.0.1',
    ].filter((h, i, arr) => h && arr.indexOf(h) === i);

    for (const host of candidateHosts) {
      for (const endpoint of ['/subscriptions/plans', '/plans']) {
        try {
          const url = `http://${host}:5000/api/v1${endpoint}`;
          const res = await axios.get(url, { timeout: 3500 });
          const raw = res.data?.data?.plans ?? res.data?.plans ?? res.data?.data ?? res.data ?? [];
          if (Array.isArray(raw) && raw.length > 0) {
            setApiHostOverride(host);
            return raw;
          }
        } catch {
          // Continue searching candidates
        }
      }
    }
    return [];
  },

  async getCurrentSubscription(): Promise<UserSubscription | null> {
    try {
      const res = await apiClient.get<{ subscription: UserSubscription | null }>(
        API_CONFIG.ENDPOINTS.SUBSCRIPTION_CURRENT
      );
      return res.data?.subscription ?? null;
    } catch {
      return null;
    }
  },

  async upgradePlan(planId: string, billingCycle: 'monthly' | 'annual'): Promise<{ success: boolean; redirectUrl?: string }> {
    const res = await apiClient.post(API_CONFIG.ENDPOINTS.SUBSCRIPTION_UPGRADE, { planId, billingCycle });
    return res.data as { success: boolean; redirectUrl?: string };
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

