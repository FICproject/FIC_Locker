import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const ACCESS_TOKEN_KEY = 'docscanner_admin_access_token';
const REFRESH_TOKEN_KEY = 'docscanner_admin_refresh_token';

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'admin-web',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function flushQueue(err: unknown, token: string | null) {
  for (const item of pendingQueue) {
    if (err || !token) {
      item.reject(err);
    } else {
      item.resolve(token);
    }
  }
  pendingQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string }>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/admin/auth/login') &&
      !originalRequest.url?.includes('/admin/auth/refresh')
    ) {
      const refreshToken = tokenStorage.getRefreshToken();
      if (!refreshToken) {
        tokenStorage.clear();
        window.dispatchEvent(new Event('admin:session-expired'));
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (newToken: string) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(apiClient(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_BASE_URL}/admin/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: nextRefresh } = res.data.data;
        tokenStorage.setTokens(accessToken, nextRefresh);
        flushQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        flushQueue(refreshErr, null);
        tokenStorage.clear();
        window.dispatchEvent(new Event('admin:session-expired'));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export function extractErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; details?: Array<{ message?: string }> } | undefined;
    if (data?.details?.length) {
      return `${data.message || 'Validation failed'}: ${data.details.map((d) => d.message).join(', ')}`;
    }
    if (data && typeof data === 'object' && data.message) return data.message;
    if (err.response?.status && err.response.status >= 500 && (!data || typeof data !== 'object')) {
      return 'Backend API server is unreachable (port 5000). Ensure backend/.env is configured and run "npm run dev:backend".';
    }
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

