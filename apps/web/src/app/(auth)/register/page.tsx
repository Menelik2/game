'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
    dateOfBirth: '1995-01-01',
    country: 'US',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-bold">Create account</h1>
      <p className="mt-2 text-white/50">Join Apex Casino (demo · virtual credits)</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
        )}
        {(['email', 'password', 'dateOfBirth', 'country'] as const).map((field) => (
          <div key={field}>
            <label className="mb-1.5 block text-sm capitalize text-white/70">
              {field === 'dateOfBirth' ? 'Date of birth' : field}
            </label>
            <input
              type={field === 'password' ? 'password' : field === 'dateOfBirth' ? 'date' : 'text'}
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              required
              className="w-full rounded-xl border border-white/10 bg-surface-800 px-4 py-3 text-sm outline-none focus:border-apex-500"
            />
          </div>
        ))}
        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-apex-500 to-apex-600 py-3.5 text-sm font-semibold shadow-glow disabled:opacity-50">
          {loading ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-white/50">
        Already have an account? <Link href="/login" className="text-apex-400 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
