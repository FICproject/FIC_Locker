import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/apiConfig';

const ACCESS_KEY = '@docscanner_admin_access_token';
const REFRESH_KEY = '@docscanner_admin_refresh_token';

export const mobileTokenStorage = {
  getAccessToken: () => AsyncStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => AsyncStorage.getItem(REFRESH_KEY),
  setTokens: async (access: string, refresh: string) => {
    await Promise.all([
      AsyncStorage.setItem(ACCESS_KEY, access),
      AsyncStorage.setItem(REFRESH_KEY, refresh),
    ]);
  },
  clear: async () => {
    await Promise.all([
      AsyncStorage.removeItem(ACCESS_KEY),
      AsyncStorage.removeItem(REFRESH_KEY),
    ]);
  },
};

let onSessionExpiredCallback: (() => void) | null = null;
export function registerSessionExpiredHandler(cb: () => void) {
  onSessionExpiredCallback = cb;
}

export const mobileApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'admin-mobile',
  },
});

mobileApiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await mobileTokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing = false;
let queue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

function flush(err: unknown, token: string | null) {
  for (const item of queue) {
    if (err || !token) item.reject(err);
    else item.resolve(token);
  }
  queue = [];
}

mobileApiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<{ message?: string }>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/admin/auth/login') &&
      !original.url?.includes('/admin/auth/refresh')
    ) {
      const refreshToken = await mobileTokenStorage.getRefreshToken();
      if (!refreshToken) {
        await mobileTokenStorage.clear();
        onSessionExpiredCallback?.();
        return Promise.reject(error);
      }

      if (refreshing) {
        return new Promise((resolve, reject) => {
          queue.push({
            resolve: (t: string) => {
              original.headers.Authorization = `Bearer ${t}`;
              resolve(mobileApiClient(original));
            },
            reject,
          });
        });
      }

      original._retry = true;
      refreshing = true;
      try {
        const res = await axios.post(`${API_BASE_URL}/admin/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: nextRefresh } = res.data.data;
        await mobileTokenStorage.setTokens(accessToken, nextRefresh);
        flush(null, accessToken);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return mobileApiClient(original);
      } catch (refreshErr) {
        flush(refreshErr, null);
        await mobileTokenStorage.clear();
        onSessionExpiredCallback?.();
        return Promise.reject(refreshErr);
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(err: unknown, fallback = 'Request failed. Check server connection.'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
