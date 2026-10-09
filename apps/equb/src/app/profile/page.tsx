'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AuthForm } from '@/components/AuthForm';
import { formatBirrCompact } from '@/lib/money';
import {
  apiUpdateProfile,
  apiDeleteAccount,
} from '@/lib/auth-api';

function sessionIsAdmin(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  return (user as { role?: string }).role === 'admin';
}

export default function ProfilePage() {
  const user = useEqubStore((s) => s.user);
  const logout = useEqubStore((s) => s.logout);
  const setSessionUser = useEqubStore((s) => s.setSessionUser);
  const claimReferral = useEqubStore((s) => s.claimReferral);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const { t, locale } = useI18n();
  const am = locale === 'am';

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [formErr, setFormErr] = useState('');

  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteErr, setDeleteErr] = useState('');
  const [deleting, setDeleting] = useState(false);

  function startEdit() {
    if (!user) return;
    setFullName(user.name || '');
    setCurrentPassword('');
    setNewPassword('');
    setFormMsg('');
    setFormErr('');
    setEditing(true);
  }

  async function saveProfile() {
    if (!user) return;
    setBusy(true);
    setFormErr('');
    setFormMsg('');
    const payload: {
      fullName?: string;
      currentPassword?: string;
      newPassword?: string;
    } = {};
    if (fullName.trim() && fullName.trim() !== user.name) {
      payload.fullName = fullName.trim();
    }
    if (newPassword) {
      if (!currentPassword) {
        setFormErr(
          am
            ? 'የይለፍ ቃል ለመቀየር የአሁኑ ያስፈልጋል'
            : 'Current password required to change password',
        );
        setBusy(false);
        return;
      }
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }
    if (Object.keys(payload).length === 0) {
      setFormErr(am ? 'ምንም ለውጥ የለም' : 'No changes');
      setBusy(false);
      return;
    }

    const r = await apiUpdateProfile(payload);
    setBusy(false);
    if (!r.ok) {
      setFormErr(r.error);
      return;
    }
    setSessionUser({
      id: r.user.id,
      name: r.user.fullName || fullName,
      phone: r.user.phone,
      email: r.user.phone || '',
      balance: r.user.balance,
      referralCode: r.user.referralCode,
      role: r.user.role === 'admin' ? 'admin' : 'player',
      banned: r.user.banned,
    });
    setFormMsg(am ? 'መገለጫ ተዘምኗል' : 'Profile updated');
    setEditing(false);
    setCurrentPassword('');
    setNewPassword('');
  }

  async function handleDelete() {
    if (!deletePassword) {
      setDeleteErr(am ? 'የይለፍ ቃል ያስገቡ' : 'Enter password');
      return;
    }
    setDeleting(true);
    setDeleteErr('');
    const r = await apiDeleteAccount({ password: deletePassword });
    setDeleting(false);
    if (!r.ok) {
      setDeleteErr(r.error);
      return;
    }
    logout();
  }

  if (!user) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t.profile.title}</h1>
          <LanguageSwitcher />
        </div>
        <div className="glass space-y-4 rounded-3xl p-6">
          <p className="text-[11px] text-white/40">
            {am
              ? 'ከመነሻ ገጽ ጋር ተመሳሳይ መግቢያ · ስልክ + የይለፍ ቃል'
              : 'Same login as home · phone + password'}
          </p>
          <AuthForm initialMode="login" redirectTo="/profile" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.profile.title}</h1>
        <LanguageSwitcher />
      </div>

      <div className="glass space-y-3 rounded-3xl p-5 text-sm">
        <div className="flex items-start justify-between gap-2">
          <p>
            <span className="text-white/40">{am ? 'ሙሉ ስም' : 'Full name'}</span>
            <br />
            <strong>{user.name}</strong>
            {sessionIsAdmin(user) && (
              <span className="ml-2 rounded-full bg-gold-500/20 px-2 py-0.5 text-[10px] font-bold text-gold-400">
                ADMIN
              </span>
            )}
          </p>
          {!editing && (
            <button
              type="button"
              onClick={startEdit}
              className="rounded-xl border border-equb-500/40 bg-equb-500/15 px-3 py-1.5 text-xs font-bold text-equb-300"
            >
              {am ? 'አርትዕ' : 'Edit'}
            </button>
          )}
        </div>
        <p>
          <span className="text-white/40">{am ? 'ስልክ' : 'Phone'}</span>
          <br />
          <strong className="font-mono text-xs">{user.phone || user.email}</strong>
        </p>
        <p>
          <span className="text-white/40">{t.profile.balance}</span>
          <br />
          <strong className="text-equb-400">
            {formatBirrCompact(user.balance, locale)}
          </strong>
        </p>
        <p>
          <span className="text-white/40">{t.profile.inviteCode}</span>
          <br />
          <strong className="font-mono tracking-widest">{user.referralCode}</strong>
        </p>
      </div>

      {editing && (
        <div className="glass space-y-3 rounded-3xl border border-equb-500/25 p-5">
          <h2 className="text-sm font-bold text-equb-300">
            {am ? 'መገለጫ አርትዕ' : 'Edit profile'}
          </h2>
          <label className="block text-xs text-white/50">
            {am ? 'ሙሉ ስም' : 'Full name'}
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm text-white"
            />
          </label>
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <p className="text-[10px] text-white/40">
              {am ? 'ስልክ (አይቀየርም)' : 'Phone (cannot be changed)'}
            </p>
            <p className="mt-0.5 font-mono text-sm text-white/70">
              {user.phone || user.email}
            </p>
          </div>
          <label className="block text-xs text-white/50">
            {am ? 'አዲስ የይለፍ ቃል (አማራጭ)' : 'New password (optional)'}
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm text-white"
              autoComplete="new-password"
            />
          </label>
          <label className="block text-xs text-white/50">
            {am
              ? 'የአሁኑ የይለፍ ቃል (የይለፍ ቃል ሲቀየር)'
              : 'Current password (required to change password)'}
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm text-white"
              autoComplete="current-password"
            />
          </label>
          {formErr && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {formErr}
            </p>
          )}
          {formMsg && (
            <p className="rounded-xl border border-equb-500/30 bg-equb-500/10 px-3 py-2 text-xs text-equb-200">
              {formMsg}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveProfile()}
              className="btn-gold flex-1 py-2.5 text-sm disabled:opacity-40"
            >
              {busy ? '...' : am ? 'አስቀምጥ' : 'Save'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
              className="rounded-2xl border border-white/15 px-4 py-2.5 text-sm text-white/60"
            >
              {am ? 'ሰርዝ' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {sessionIsAdmin(user) && (
        <Link href="/admin" className="btn-gold block w-full text-center">
          Admin dashboard
        </Link>
      )}

      {!user.referredBy && !sessionIsAdmin(user) && (
        <div className="glass rounded-3xl p-5">
          <h2 className="font-semibold">{t.profile.haveCode}</h2>
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm"
            />
            <button
              type="button"
              className="rounded-xl bg-equb-500/30 px-4 text-sm font-bold text-equb-300"
              onClick={() => setMsg(claimReferral(code).message)}
            >
              {t.profile.apply}
            </button>
          </div>
          {msg && <p className="mt-2 text-xs text-amber-300">{msg}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={() => logout()}
        className="w-full rounded-2xl border border-white/15 py-3 text-sm text-white/70"
      >
        {t.common.signOut}
      </button>

      {!sessionIsAdmin(user) && (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-5">
          {!showDelete ? (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="w-full text-center text-sm font-semibold text-red-300/90"
            >
              {am ? 'መለያ ሰርዝ' : 'Delete account'}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-red-200/80">
                {am
                  ? 'ይህ እርምጃ ቋሚ ነው። የይለፍ ቃልዎን ያረጋግጡ።'
                  : 'This is permanent. Confirm with your password.'}
              </p>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder={am ? 'የይለፍ ቃል' : 'Password'}
                className="w-full rounded-xl border border-red-500/30 bg-black/40 px-3 py-2.5 text-sm"
              />
              {deleteErr && (
                <p className="text-xs text-red-300">{deleteErr}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleDelete()}
                  className="flex-1 rounded-2xl bg-red-600/80 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  {deleting ? '...' : am ? 'አዎ፣ ሰርዝ' : 'Yes, delete'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDelete(false);
                    setDeletePassword('');
                    setDeleteErr('');
                  }}
                  className="rounded-2xl border border-white/15 px-4 py-2.5 text-sm text-white/60"
                >
                  {am ? 'ተመለስ' : 'Back'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
