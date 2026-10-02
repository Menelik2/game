'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('demo@apexcasino.com');
  const [password, setPassword] = useState('Demo123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.push('/');
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <p className="mt-2 text-white/50">Sign in to your Apex account</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm text-white/70">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-xl border border-white/10 bg-surface-800 px-4 py-3 text-sm outline-none focus:border-apex-500"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-white/70">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/10 bg-surface-800 px-4 py-3 text-sm outline-none focus:border-apex-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-apex-500 to-apex-600 py-3.5 text-sm font-semibold shadow-glow disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-white/40">
        Demo: demo@apexcasino.com / Demo123! · Admin: admin@apexcasino.com / Admin123!
      </p>
      <p className="mt-6 text-center text-sm text-white/50">
        No account?{' '}
        <Link href="/register" className="text-apex-400 hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
