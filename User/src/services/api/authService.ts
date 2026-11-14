import { apiClient, TOKEN_KEY, REFRESH_TOKEN_KEY } from './client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../../constants';
import { AuthResponse, UserProfile } from '../../types';

export const authService = {
  async register(data: { name: string; email: string; password: string; phone?: string }): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>(API_CONFIG.ENDPOINTS.AUTH_REGISTER, data);
    if (res.data?.tokens?.accessToken) {
      await AsyncStorage.setItem(TOKEN_KEY, res.data.tokens.accessToken);
      if (res.data.tokens.refreshToken) {
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, res.data.tokens.refreshToken);
      }
    }
    return res.data;
  },

  async login(data: { email: string; password: string }): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>(API_CONFIG.ENDPOINTS.AUTH_LOGIN, data);
    if (res.data?.tokens?.accessToken) {
      await AsyncStorage.setItem(TOKEN_KEY, res.data.tokens.accessToken);
      if (res.data.tokens.refreshToken) {
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, res.data.tokens.refreshToken);
      }
    }
    return res.data;
  },

  async sendOtp(data: { identifier: string; type: 'email' | 'phone' }): Promise<{ message: string; otpSent: boolean }> {
    const res = await apiClient.post<{ message: string; otpSent: boolean }>(API_CONFIG.ENDPOINTS.AUTH_SEND_OTP, data);
    return res.data;
  },

  async verifyOtp(data: { identifier: string; otp: string }): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>(API_CONFIG.ENDPOINTS.AUTH_VERIFY_OTP, data);
    if (res.data?.tokens?.accessToken) {
      await AsyncStorage.setItem(TOKEN_KEY, res.data.tokens.accessToken);
    }
    return res.data;
  },

  async forgotPassword(data: { email: string }): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>(API_CONFIG.ENDPOINTS.AUTH_FORGOT_PASSWORD, data);
    return res.data;
  },

  async resetPassword(data: { tokenOrOtp: string; newPassword: string }): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>(API_CONFIG.ENDPOINTS.AUTH_RESET_PASSWORD, data);
    return res.data;
  },

  async getCurrentUser(): Promise<UserProfile> {
    const res = await apiClient.get<{ user: UserProfile }>(API_CONFIG.ENDPOINTS.AUTH_ME);
    return res.data.user;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post(API_CONFIG.ENDPOINTS.AUTH_LOGOUT);
    } catch (e) {
      // ignore server logout failure and clear storage
    }
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, '@fic_locker_user_profile']);
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return !!token;
  },
};

