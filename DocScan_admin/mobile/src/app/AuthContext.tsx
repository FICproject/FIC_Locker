import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AdminProfile } from '../types/admin';
import { adminMobileApi } from '../services/adminMobileApi';
import { mobileTokenStorage, registerSessionExpiredHandler } from '../services/apiClient';

interface MobileAuthContextValue {
  admin: AdminProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<MobileAuthContextValue | undefined>(undefined);

export function MobileAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    registerSessionExpiredHandler(() => {
      setAdmin(null);
    });

    (async () => {
      try {
        const token = await mobileTokenStorage.getAccessToken();
        if (!token) {
          setAdmin(null);
          return;
        }
        const profile = await adminMobileApi.auth.me();
        setAdmin(profile);
      } catch {
        await mobileTokenStorage.clear();
        setAdmin(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await adminMobileApi.auth.login(email, password);
    await mobileTokenStorage.setTokens(data.accessToken, data.refreshToken);
    setAdmin(data.admin);
  }, []);

  const logout = useCallback(async () => {
    try {
      const token = await mobileTokenStorage.getAccessToken();
      if (token) {
        await adminMobileApi.auth.logout();
      }
    } finally {
      await mobileTokenStorage.clear();
      setAdmin(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useMobileAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useMobileAuth must be used inside MobileAuthProvider');
  return ctx;
}
