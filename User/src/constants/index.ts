export const API_CONFIG = {
  BASE_URL: 'http://localhost:5000/api/v1',
  TIMEOUT: 15000,
  ENDPOINTS: {
    // Auth
    AUTH_REGISTER: '/auth/register',
    AUTH_LOGIN: '/auth/login',
    AUTH_LOGOUT: '/auth/logout',
    AUTH_SEND_OTP: '/auth/send-otp',
    AUTH_VERIFY_OTP: '/auth/verify-otp',
    AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
    AUTH_RESET_PASSWORD: '/auth/reset-password',
    AUTH_REFRESH_TOKEN: '/auth/refresh-token',
    AUTH_ME: '/auth/me',

    // Documents
    DOCUMENTS: '/documents',
    DOCUMENT_BY_ID: (id: string) => `/documents/${id}`,
    DOCUMENT_DOWNLOAD: (id: string) => `/documents/${id}/download`,
    DOCUMENT_UPLOAD_AUTH: '/documents/upload-auth',
    DOCUMENT_CONFIRM_UPLOAD: (id: string) => `/documents/${id}/confirm`,
    DOCUMENT_FAVOURITE: (id: string) => `/documents/${id}/favourite`,
    DOCUMENT_ARCHIVE: (id: string) => `/documents/${id}/archive`,
    DOCUMENT_RESTORE: (id: string) => `/documents/${id}/restore`,
    DOCUMENT_MOVE: (id: string) => `/documents/${id}/move`,

    // Categories & Folders
    CATEGORIES: '/categories',
    FOLDERS: '/folders',
    FOLDER_BY_ID: (id: string) => `/folders/${id}`,

    // Storage
    STORAGE_INFO: '/storage/info',

    // Reminders
    REMINDERS: '/reminders',
    REMINDER_BY_ID: (id: string) => `/reminders/${id}`,

    // Profile & Settings
    PROFILE: '/profile',
    PROFILE_PASSWORD: '/profile/password',
    PROFILE_NOTIFICATIONS: '/profile/notifications',
    PROFILE_DELETE_REQUEST: '/profile/delete-request',

    // Subscriptions
    PLANS: '/subscriptions/plans',
    SUBSCRIPTION_CURRENT: '/subscriptions/current',
    SUBSCRIPTION_UPGRADE: '/subscriptions/upgrade',
    SUBSCRIPTION_CANCEL: '/subscriptions/cancel',

    // Support
    SUPPORT_TICKETS: '/support/tickets',
    SUPPORT_TICKET_BY_ID: (id: string) => `/support/tickets/${id}`,
  },
};

export const DEFAULT_CATEGORIES = [
  { id: '1', name: 'Personal Documents', icon: 'user', color: '#6C47FF' },
  { id: '2', name: 'Identity Proof', icon: 'shield', color: '#4F46E5' },
  { id: '3', name: 'Education Documents', icon: 'book', color: '#7C3AED' },
  { id: '4', name: 'Financial Documents', icon: 'credit-card', color: '#2563EB' },
  { id: '5', name: 'Medical Documents', icon: 'plus-circle', color: '#E11D48' },
  { id: '6', name: 'Other Documents', icon: 'folder', color: '#6B7280' },
];

