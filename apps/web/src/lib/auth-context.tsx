'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, ApiError, isApiConfigured } from './api';

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

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const t = localStorage.getItem('apex_token');
    if (!t) {
      setUser(null);
      setToken(null);
      return;
    }

    if (!isApiConfigured()) {
      // Keep token but no user profile until API is reachable
      setToken(t);
      return;
    }

    try {
      const me = await api<User>('/me', { token: t });
      setUser(me);
      setToken(t);
    } catch (err: any) {
      // Only wipe session on real auth failures (401/403), not network blips
      const status = err?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('apex_token');
        setUser(null);
        setToken(null);
      } else {
        // Keep token; user may still use app once API recovers
        setToken(t);
      }
    }
  }, []);

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  const login = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      throw new ApiError('Email and password are required', { code: 'VALIDATION_ERROR', status: 400 });
    }
    if (!isApiConfigured()) {
      throw new ApiError(
        'API is not reachable. Start the backend on port 3001 or set NEXT_PUBLIC_API_URL.',
        { code: 'API_OFFLINE', status: 0 },
      );
    }
    try {
      const res = await api<{ user: User; accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      if (!res?.accessToken) {
        throw new ApiError('Login response missing access token', { code: 'HTTP_ERROR', status: 500 });
      }
      localStorage.setItem('apex_token', res.accessToken);
      setToken(res.accessToken);
      setUser(res.user);
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Login failed', {
        code: err?.code || 'HTTP_ERROR',
        status: err?.status,
      });
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    dateOfBirth: string;
    country: string;
  }) => {
    const normalizedEmail = data.email.trim().toLowerCase();
    if (!isApiConfigured()) {
      throw new ApiError(
        'API is not reachable. Start the backend on port 3001 or set NEXT_PUBLIC_API_URL.',
        { code: 'API_OFFLINE', status: 0 },
      );
    }
    const res = await api<{ user: User; accessToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        email: normalizedEmail,
        acceptTerms: true,
        acceptAge: true,
      }),
    });
    if (!res?.accessToken) {
      throw new ApiError('Registration response missing access token', {
        code: 'HTTP_ERROR',
        status: 500,
      });
    }
    localStorage.setItem('apex_token', res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      if (token && isApiConfigured()) {
        await api('/auth/logout', { method: 'POST', token });
      }
    } catch {
      /* ignore */
    }
    localStorage.removeItem('apex_token');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
