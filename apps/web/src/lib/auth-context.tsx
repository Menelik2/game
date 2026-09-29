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

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const refreshMe = useCallback(async () => {
    if (typeof window === 'undefined') return;

    if (!isApiConfigured()) {
      setOffline(true);
      const local = localStorage.getItem('apex_demo_user');
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

    setOffline(false);
    try {
      const t = localStorage.getItem('apex_token');
      if (!t) {
        setUser(null);
        setToken(null);
        return;
      }
      const me = await api<User>('/me', { token: t });
      setUser(me);
      setToken(t);
    } catch {
      localStorage.removeItem('apex_token');
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  const login = async (email: string, password: string) => {
    if (!isApiConfigured()) {
      const ok =
        (email === 'demo@apexcasino.com' && password === 'Demo123!') ||
        (email === 'admin@apexcasino.com' && password === 'Admin123!') ||
        password.length >= 6;
      if (!ok) throw new ApiError('Invalid credentials');
      const u: User = {
        ...DEMO_USER,
        id: email.startsWith('admin') ? 'demo-local-admin' : 'demo-local-user',
        email,
        isAdmin: email.startsWith('admin'),
      };
      localStorage.setItem('apex_demo_user', JSON.stringify(u));
      setUser(u);
      setToken('demo-offline-token');
      setOffline(true);
      return;
    }

    const res = await api<{ user: User; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('apex_token', res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
    setOffline(false);
  };

  const register = async (data: {
    email: string;
    password: string;
    dateOfBirth: string;
    country: string;
  }) => {
    if (!isApiConfigured()) {
      const u: User = { ...DEMO_USER, email: data.email };
      localStorage.setItem('apex_demo_user', JSON.stringify(u));
      setUser(u);
      setToken('demo-offline-token');
      setOffline(true);
      return;
    }

    const res = await api<{ user: User; accessToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...data, acceptTerms: true, acceptAge: true }),
    });
    localStorage.setItem('apex_token', res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      if (token && isApiConfigured() && token !== 'demo-offline-token') {
        await api('/auth/logout', { method: 'POST', token });
      }
    } catch {
      /* ignore */
    }
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
