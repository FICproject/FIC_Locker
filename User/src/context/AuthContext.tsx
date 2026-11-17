import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types';
import { authService } from '../services/api/authService';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkAuth = async () => {
    try {
      const isAuth = await authService.isAuthenticated();
      if (isAuth) {
        // Try to fetch current user profile from backend
        try {
          const profile = await authService.getCurrentUser();
          setUser(profile);
          await AsyncStorage.setItem('@fic_locker_user_profile', JSON.stringify(profile));
        } catch (fetchErr) {
          // If offline, check cached profile
          const cached = await AsyncStorage.getItem('@fic_locker_user_profile');
          if (cached) {
            setUser(JSON.parse(cached));
          } else {
            setUser(null);
          }
        }
      } else {
        setUser(null);
      }
    } catch (e) {
      console.warn('[AuthProvider] Auth check failed:', e);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await authService.login({ email, password: pass });
    setUser(res.user);
    await AsyncStorage.setItem('@fic_locker_user_profile', JSON.stringify(res.user));
  };

  const register = async (name: string, email: string, pass: string, phone?: string) => {
    const res = await authService.register({ name, email, password: pass, phone });
    setUser(res.user);
    await AsyncStorage.setItem('@fic_locker_user_profile', JSON.stringify(res.user));
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const refreshProfile = async () => {
    try {
      const profile = await authService.getCurrentUser();
      setUser(profile);
    } catch (e) {
      console.warn('Failed to refresh profile:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

