import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { API_CONFIG } from '../../constants';

const TOKEN_KEY = '@docuscan_access_token';
const REFRESH_TOKEN_KEY = '@docuscan_refresh_token';

class ApiClient {
  private instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // Request interceptor to attach JWT bearer token
    this.instance.interceptors.request.use(
      async (config) => {
        try {
          const token = await AsyncStorage.getItem(TOKEN_KEY);
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (e) {
          console.warn('[ApiClient] Failed to read token from storage:', e);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token expiry / suspensions
    this.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
            if (refreshToken) {
              const res = await axios.post(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH_REFRESH_TOKEN}`, {
                refreshToken,
              });
              if (res.data?.tokens?.accessToken) {
                await AsyncStorage.setItem(TOKEN_KEY, res.data.tokens.accessToken);
                originalRequest.headers.Authorization = `Bearer ${res.data.tokens.accessToken}`;
                return this.instance(originalRequest);
              }
            }
          } catch (refreshErr) {
            console.warn('[ApiClient] Refresh token failed. Logging out...', refreshErr);
            await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  public get<T>(url: string, config?: AxiosRequestConfig) {
    return this.instance.get<T>(url, config);
  }

  public post<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.instance.post<T>(url, data, config);
  }

  public put<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.instance.put<T>(url, data, config);
  }

  public patch<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.instance.patch<T>(url, data, config);
  }

  public delete<T>(url: string, config?: AxiosRequestConfig) {
    return this.instance.delete<T>(url, config);
  }
}

export const apiClient = new ApiClient();
export { TOKEN_KEY, REFRESH_TOKEN_KEY };

