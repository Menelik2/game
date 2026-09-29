'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, isApiConfigured, ApiError } from './api';

interface User {
  id: string;
  email: string;
  status: string;
  isAdmin?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  offline: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    dateOfBirth: string;
    country: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const DEMO_USER: User = {
  id: 'demo-local-user',
  email: 'demo@apexcasino.com',
  status: 'ACTIVE',
  isAdmin: false,
};

function offlineLoginUser(email: string, password: string): User {
  const normalized = email.trim().toLowerCase();
  const ok =
    (normalized === 'demo@apexcasino.com' && password === 'Demo123!') ||
    (normalized === 'admin@apexcasino.com' && password === 'Admin123!') ||
    password.length >= 6;
  if (!ok) throw new ApiError('Invalid credentials');
  return {
    ...DEMO_USER,
    id: normalized.startsWith('admin') ? 'demo-local-admin' : 'demo-local-user',
    email: normalized,
    isAdmin: normalized.startsWith('admin'),
  };
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const applyOfflineUser = (u: User) => {
    localStorage.setItem('apex_demo_user', JSON.stringify(u));
    localStorage.removeItem('apex_token');
    setUser(u);
    setToken('demo-offline-token');
    setOffline(true);
  };

  const refreshMe = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const local = localStorage.getItem('apex_demo_user');
    if (!isApiConfigured()) {
      setOffline(true);
      if (local) {
        try {
          setUser(JSON.parse(local));
          setToken('demo-offline-token');
        } catch {
          setUser(null);
          setToken(null);
        }
      }
      return;
    }
    try {
      const t = localStorage.getItem('apex_token');
      if (!t || t === 'demo-offline-token') {
        if (local) {
          setUser(JSON.parse(local));
          setToken('demo-offline-token');
          setOffline(true);
        } else {
          setUser(null);
          setToken(null);
        }
        return;
      }
      const me = await api<User>('/me', { token: t });
      setUser(me);
      setToken(t);
      setOffline(false);
    } catch {
      localStorage.removeItem('apex_token');
      if (local) {
        try {
          setUser(JSON.parse(local));
          setToken('demo-offline-token');
          setOffline(true);
          return;
        } catch {}
      }
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  const login = async (email: string, password: string) => {
    if (!isApiConfigured()) {
      applyOfflineUser(offlineLoginUser(email, password));
      return;
    }
    try {
      const res = await api<{ user: User; accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('apex_token', res.accessToken);
      localStorage.removeItem('apex_demo_user');
      setToken(res.accessToken);
      setUser(res.user);
      setOffline(false);
    } catch (err: any) {
      const status = err?.status;
      const code = err?.code;
      if (
        status === 0 ||
        status === 404 ||
        status === 502 ||
        status === 503 ||
        code === 'NETWORK' ||
        code === 'API_OFFLINE' ||
        code === 'HTTP_ERROR'
      ) {
        applyOfflineUser(offlineLoginUser(email, password));
        return;
      }
      throw err;
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    dateOfBirth: string;
    country: string;
  }) => {
    if (!isApiConfigured()) {
      applyOfflineUser(offlineLoginUser(data.email, data.password));
      return;
    }
    try {
      const res = await api<{ user: User; accessToken: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...data, acceptTerms: true, acceptAge: true }),
      });
      localStorage.setItem('apex_token', res.accessToken);
      setToken(res.accessToken);
      setUser(res.user);
      setOffline(false);
    } catch (err: any) {
      const status = err?.status;
      if (status === 0 || status === 404 || status === 502 || status === 503) {
        applyOfflineUser(offlineLoginUser(data.email, data.password));
        return;
      }
      throw err;
    }
  };

  const logout = async () => {
    try {
      if (token && isApiConfigured() && token !== 'demo-offline-token') {
        await api('/auth/logout', { method: 'POST', token });
      }
    } catch {}
    localStorage.removeItem('apex_token');
    localStorage.removeItem('apex_demo_user');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, offline, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
