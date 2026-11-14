import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AdminProfile } from '@docscanner/shared-types';
import { adminApi } from '../services/adminApi';
import { tokenStorage } from '../lib/apiClient';

interface AuthContextValue {
  admin: AdminProfile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setAdmin(null);
      setIsLoading(false);
      return;
    }
    try {
      const profile = await adminApi.auth.me();
      setAdmin(profile);
    } catch {
      // If session is truly expired, apiClient response interceptor emits 'admin:session-expired'
      if (!tokenStorage.getAccessToken()) {
        setAdmin(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
    const handleExpired = () => {
      setAdmin(null);
    };
    window.addEventListener('admin:session-expired', handleExpired);
    return () => window.removeEventListener('admin:session-expired', handleExpired);
  }, [refreshProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await adminApi.auth.login(email, password);
    tokenStorage.setTokens(data.accessToken, data.refreshToken);
    setAdmin(data.admin);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (tokenStorage.getAccessToken()) {
        await adminApi.auth.logout();
      }
    } finally {
      tokenStorage.clear();
      setAdmin(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ admin, isLoading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

