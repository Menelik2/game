'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEqubStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { LiveBalance } from '@/components/LiveBalance';
import { EthDateBadge } from '@/components/EthDateBadge';
import { ArrowDownToLine, ArrowUpFromLine, History, Copy } from 'lucide-react';

const SEND_TO = '0977832379';
const ACCOUNT_NAME = 'Menelik';

type Tab = 'deposit' | 'withdraw' | 'history';

type Claim = {
  id: string;
  amount: number | null;
  txnRef: string;
  status: string;
  createdAt: string;
};

export default function WalletPage() {
  const user = useEqubStore((s) => s.user);
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<Tab>('deposit');
  const [sms, setSms] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [copied, setCopied] = useState(false);

  const loadClaims = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(
        `/api/payments/telebirr/claims?userId=${encodeURIComponent(user.id)}`,
      );
      const json = await res.json();
      if (json?.success) setClaims(json.data?.items || []);
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(SEND_TO);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  async function verify() {
    if (!user) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/payments/telebirr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          phone: user.phone,
          sms,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setMsg(json?.message || 'Could not submit');
        return;
      }
      setMsg(
        locale === 'am'
          ? 'ተልካል። ቀሪ ሂሳብ ከተረጋገጠ በሃዋ ይገምራል።'
          : json.data?.message ||
              'Submitted. Balance updates after verification.',
      );
      setSms('');
      setTab('history');
      await loadClaims();
    } catch {
      setMsg('Network error');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <p className="py-12 text-center text-white/50">{t.wallet.signInFirst}</p>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-gold-400 bg-white/5 text-white/70">
            <span className="text-lg">👤</span>
          </div>
          <div>
            <p className="font-bold">{user.name}</p>
            <p className="text-xs text-white/40">{user.phone || ''}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-wide text-gold-400">
            BALANCE
          </p>
          <LiveBalance size="md" />
          <EthDateBadge short />
        </div>
      </div>

      <div className="grid grid-cols-3 overflow-hidden rounded-2xl bg-white/5 p-1">
        {(
          [
            ['deposit', locale === 'am' ? 'አስገባ' : 'Deposit', ArrowDownToLine],
            ['withdraw', locale === 'am' ? 'አውጣ' : 'Withdraw', ArrowUpFromLine],
            ['history', locale === 'am' ? 'ታሪክ' : 'History', History],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              tab === key
                ? 'flex items-center justify-center gap-1 rounded-xl bg-gold-500 py-2.5 text-sm font-black text-black'
                : 'flex items-center justify-center gap-1 py-2.5 text-sm text-white/70'
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'deposit' && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-white/60">
              {locale === 'am' ? 'የክፍያ ዘዴ' : 'Payment Method'}
            </p>
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
              Telebirr
            </div>
          </div>

          <div className="rounded-2xl border border-gold-500/40 bg-gold-500/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-white/70">
                {locale === 'am' ? 'ላክ ወደ' : 'Send to'}:{' '}
                <span className="text-xl font-black tracking-wide text-white underline">
                  {SEND_TO}
                </span>
              </p>
              <button
                type="button"
                onClick={() => void copyPhone()}
                className="rounded-xl bg-gold-500 p-2 text-black"
                aria-label="Copy"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            {copied && (
              <p className="mt-1 text-[11px] text-gold-300">
                {locale === 'am' ? 'ተቀድቷል' : 'Copied'}
              </p>
            )}
            <p className="mt-2 text-sm text-white/70">
              Telebirr account name:{' '}
              <span className="font-bold text-white">{ACCOUNT_NAME}</span>
            </p>
            <p className="mt-2 text-xs text-white/50">
              {locale === 'am'
                ? 'ገንዘብ ላክ፣ ከዚያም የማረጋገጫ SMS እዚህ ለጥፍ።'
                : 'Send money, then paste your confirmation SMS below.'}
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm text-white/70">
              {locale === 'am'
                ? 'የማረጋገጫ SMS ወይም የግብይት ቁጥር'
                : 'Confirmation SMS or Transaction Number'}
            </p>
            <textarea
              value={sms}
              onChange={(e) => setSms(e.target.value)}
              rows={5}
              placeholder={
                locale === 'am'
                  ? 'ሙሉ SMS ወይም የግብይት ቁጥር ለጥፍ'
                  : 'Paste the whole confirmation SMS here — or just the transaction number.'
              }
              className="w-full rounded-2xl border border-gold-500/30 bg-black/40 px-4 py-3 text-sm outline-none"
            />
          </div>

          <button
            type="button"
            disabled={busy || sms.trim().length < 4}
            onClick={() => void verify()}
            className="w-full rounded-2xl bg-gold-500 py-3.5 text-base font-black text-black disabled:opacity-40"
          >
            {busy
              ? '…'
              : locale === 'am'
                ? 'ተቀማጅ አረጋግጥ'
                : 'Verify Deposit'}
          </button>
          {msg && <p className="text-center text-xs text-equb-300">{msg}</p>}
          <p className="text-center text-[10px] text-white/35">
            {locale === 'am'
              ? 'ቀሪ ሂሳብ ከተረጋገጠ በሃዋ ብቻ ይገምራል።'
              : 'Balance is credited only after the SMS is verified — not instantly.'}
          </p>
        </div>
      )}

      {tab === 'withdraw' && (
        <div className="rounded-2xl border border-white/10 p-4 text-sm text-white/60">
          {locale === 'am'
            ? 'መውጣት በቴሌብር ወደ ስልክዎ። አስተዳዳሪ ካረጋገጠ በሃዋ ይላካል።'
            : 'Withdrawals go to your Telebirr number after admin approval.'}
        </div>
      )}

      {tab === 'history' && (
        <ul className="space-y-2">
          {claims.length === 0 && (
            <p className="text-sm text-white/40">
              {locale === 'am' ? 'ገና የለም' : 'No deposits yet'}
            </p>
          )}
          {claims.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-white/10 px-3 py-2 text-sm"
            >
              <div className="flex justify-between">
                <span className="font-mono text-xs">{c.txnRef}</span>
                <span
                  className={
                    c.status === 'APPROVED'
                      ? 'text-equb-300'
                      : c.status === 'REJECTED'
                        ? 'text-red-300'
                        : 'text-gold-300'
                  }
                >
                  {c.status}
                </span>
              </div>
              <p className="text-[11px] text-white/40">
                {c.amount != null ? `${c.amount} ETB · ` : ''}
                {new Date(c.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
