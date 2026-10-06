'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { LiveBalance } from '@/components/LiveBalance';
import { EthDateBadge } from '@/components/EthDateBadge';
import { TelebirrClaimForm } from '@/components/TelebirrClaim';
import {
  Copy,
  ExternalLink,
  Smartphone,
  CheckCircle2,
  Clock,
  XCircle,
  Wallet as WalletIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  Phone,
  User,
  ShieldCheck,
} from 'lucide-react';
import clsx from 'clsx';

type Cfg = {
  merchantName: string;
  merchantPhone: string;
  checkoutAvailable: boolean;
  instruction: string;
  environment: string;
  verifier?: string;
  verifyConfigured?: boolean;
};

type Deposit = {
  id: string;
  amount: number;
  status: string;
  merchantOrderId: string;
  createdAt: string;
  failureReason: string | null;
  transactionNumber?: string | null;
};

const PRESETS = [50, 100, 200, 500, 1000, 2000];

export default function WalletPage() {
  const user = useEqubStore((s) => s.user);
  const setSessionUser = useEqubStore((s) => s.setSessionUser);
  const refreshBalance = useEqubStore((s) => s.refreshBalance);
  const { locale } = useI18n();
  const am = locale === 'am';

  const [tab, setTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [amount, setAmount] = useState('100');
  const [txn, setTxn] = useState('');
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [items, setItems] = useState<Deposit[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [copied, setCopied] = useState<'phone' | 'name' | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const flash = (type: 'ok' | 'err' | 'info', text: string) => {
    setMsg({ type, text });
  };

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(
        `/api/wallet/deposits?userId=${encodeURIComponent(user.id)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (json?.success) {
        setCfg(json.config);
        setItems(json.deposits || []);
        if (
          json.wallet?.balance != null &&
          Number.isFinite(Number(json.wallet.balance))
        ) {
          const serverBal = Number(json.wallet.balance);
          if (serverBal > 0 || user.balance === 0) {
            setSessionUser({ ...user, balance: serverBal });
          }
        }
      }
    } catch {
      /* ignore */
    }
    refreshBalance();
  }, [user, setSessionUser, refreshBalance]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startDeposit() {
    if (!user) return;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      flash('err', am ? 'ትክክለኛ መጠን ያስገቡ' : 'Enter a valid amount');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/wallet/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: n,
          paymentMethod: 'telebirr',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        flash('err', json.message || (am ? 'ትዕዛዝ አልተፈጠረም' : 'Could not create deposit'));
        return;
      }
      setDeposit(json.deposit);
      setStep(2);
      flash(
        'info',
        am
          ? 'ትዕዛዝ ተፈጥሯል። ቴሌብር ይላኩ፣ ከዚያ የግብይት ቁጥር ያስገቡ።'
          : 'Order created. Send Telebirr, then paste the transaction number.',
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function verifyTxn() {
    if (!user || !deposit) {
      flash('err', am ? 'መጀመሪያ ትዕዛዝ ይፍጠሩ' : 'Create the deposit first');
      return;
    }
    if (!txn.trim() || txn.trim().length < 6) {
      flash(
        'err',
        am ? 'የቴሌብር ግብይት ቁጥር ያስገቡ' : 'Enter Telebirr transaction number',
      );
      return;
    }
    setBusy(true);
    flash('info', am ? 'በ Verify.ET እየተረጋገጠ ነው…' : 'Verifying with Verify.ET…');
    try {
      const res = await fetch(`/api/wallet/deposits/${deposit.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          transactionNumber: txn.trim(),
        }),
      });
      const json = await res.json();

      if (json.success && json.status === 'CONFIRMED') {
        flash(
          'ok',
          am
            ? `ተረጋግጧል! ቀሪ ሂሳብ ${Number(json.balance).toFixed(2)} ብር`
            : `Confirmed! Balance ${Number(json.balance).toFixed(2)} ETB`,
        );
        if (json.balance != null && Number.isFinite(Number(json.balance))) {
          setSessionUser({ ...user, balance: Number(json.balance) });
        } else {
          refreshBalance();
        }
        setTxn('');
        setDeposit(null);
        setStep(1);
        setTab('history');
      } else if (json.status === 'REVIEW_REQUIRED' || json.status === 'PROCESSING') {
        flash(
          'info',
          json.message ||
            (am
              ? 'በእይታ ላይ ነው — አስተዳዳሪ ይረጋግጣል'
              : 'Under review — admin will confirm soon'),
        );
        setStep(3);
      } else {
        flash('err', json.message || (am ? 'ማረጋገጥ አልተሳካም' : 'Verification failed'));
      }
      await load();
    } catch {
      flash('err', am ? 'እንደገና ይሞክሩ' : 'Unable to verify. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, kind: 'phone' | 'name') {
    void navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 py-16 text-center">
        <WalletIcon className="mx-auto h-10 w-10 text-white/30" />
        <p className="mt-3 text-sm text-white/50">
          {am ? 'መጀመሪያ ይግቡ' : 'Sign in to open your wallet'}
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-black"
        >
          {am ? 'ግባ' : 'Sign in'}
        </Link>
      </div>
    );
  }

  const shown = Number(user.balance) || 0;
  const phone = cfg?.merchantPhone || '0977832379';
  const name = cfg?.merchantName || 'Menelik';

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-12">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#121a16] via-[#0c1210] to-[#0a1210] p-5">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-equb-500 to-equb-700 text-lg font-black text-white shadow-lg shadow-equb-500/30">
              {(user.name || 'U').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-bold text-white">{user.name}</p>
              <p className="font-mono text-xs text-white/45">{user.phone}</p>
            </div>
          </div>
          <EthDateBadge short />
        </div>

        <div className="relative mt-5 rounded-2xl border border-amber-500/20 bg-black/40 px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/80">
            {am ? 'ቀሪ ሂሳብ' : 'BALANCE'}
          </p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="font-mono text-3xl font-black tabular-nums text-white">
              {shown.toFixed(2)}
              <span className="ml-1 text-base font-bold text-amber-300">ETB</span>
            </p>
            <LiveBalance size="sm" />
          </div>
          <p className="mt-1 text-[11px] text-white/40">
            {am ? 'ሊወጣ የሚችል' : 'Withdrawable'}: {shown.toFixed(2)} ETB
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/[0.05] p-1">
        {(
          [
            ['deposit', am ? 'አስገባ' : 'Deposit', ArrowDownToLine],
            ['withdraw', am ? 'አውጣ' : 'Withdraw', ArrowUpFromLine],
            ['history', am ? 'ታሪክ' : 'History', History],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={clsx(
              'flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition',
              tab === k
                ? 'bg-amber-400 text-black shadow-md shadow-amber-500/25'
                : 'text-white/55 hover:text-white/80',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <p
          className={clsx(
            'rounded-xl border px-3 py-2.5 text-center text-sm',
            msg.type === 'ok' && 'border-equb-500/30 bg-equb-500/10 text-equb-200',
            msg.type === 'err' && 'border-red-500/30 bg-red-500/10 text-red-200',
            msg.type === 'info' && 'border-amber-500/30 bg-amber-500/10 text-amber-100',
          )}
        >
          {msg.text}
        </p>
      )}

      {tab === 'deposit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
                <Smartphone className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold">Telebirr</p>
                <p className="text-[10px] text-white/40">
                  {cfg?.verifier === 'verify.et' ? 'Verify.ET' : 'Manual + admin'}
                </p>
              </div>
            </div>
            <a
              href="https://verify.et/verify"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300"
            >
              Verify.ET <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-b from-amber-500/10 to-transparent p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
              {am ? 'ክፍያ ይላኩ ወደ' : 'Send payment to'}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-amber-400" />
                <span className="font-mono text-2xl font-black tracking-wide text-white underline decoration-amber-400/50">
                  {phone}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copy(phone, 'phone')}
                className="rounded-xl bg-amber-400 p-2.5 text-black shadow-md shadow-amber-500/30 active:scale-95"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            {copied === 'phone' && (
              <p className="mt-1 text-[11px] font-semibold text-amber-300">
                {am ? 'ተቀድቷል!' : 'Copied!'}
              </p>
            )}

            <div className="mt-3 flex items-center justify-between rounded-xl bg-black/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-white/40" />
                <span className="text-xs text-white/50">
                  {am ? 'የቴሌብር ስም' : 'Telebirr account name'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-200">{name}</span>
                <button
                  type="button"
                  onClick={() => copy(name, 'name')}
                  className="rounded-lg bg-white/10 p-1.5 text-white/60"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-white/50">
              {am
                ? 'ቴሌብር ወደ ቁጥሩ ይላኩ፣ ከዚያ የግብይት ቁጥር ብቻ ያስገቡ።'
                : 'Send Telebirr to this number, then paste only the transaction number below.'}
            </p>
          </div>

          {/* Primary: transaction number only */}
          <TelebirrClaimForm />

          <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <summary className="cursor-pointer text-xs font-semibold text-white/50">
              {am ? 'አማራጭ · ትዕዛዝ + መጠን' : 'Optional · order + amount first'}
            </summary>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(String(p))}
                    className={clsx(
                      'rounded-xl py-2 text-sm font-bold',
                      Number(amount) === p
                        ? 'bg-amber-400 text-black'
                        : 'border border-white/10 bg-white/5 text-white/70',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-sm"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void startDeposit()}
                className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-bold text-white/80"
              >
                {am ? 'ትዕዛዝ ፍጠር' : 'Create order'}
              </button>
              {deposit && (
                <p className="text-xs text-equb-200">
                  Order {deposit.merchantOrderId} · {deposit.amount} ETB
                </p>
              )}
              <input
                value={txn}
                onChange={(e) => setTxn(e.target.value)}
                placeholder="txn for order verify"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-sm"
              />
              <button
                type="button"
                disabled={busy || !deposit}
                onClick={() => void verifyTxn()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-sm font-bold"
              >
                <ShieldCheck className="h-4 w-4" />
                {am ? 'በትዕዛዝ አረጋግጥ' : 'Verify against order'}
              </button>
            </div>
          </details>
        </div>
      )}

      {tab === 'withdraw' && (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-center">
          <ArrowUpFromLine className="mx-auto h-8 w-8 text-white/25" />
          <p className="mt-3 text-sm text-white/55">
            {am ? 'ማውጣት የአስተዳዳሪ ፈቃድ ይፈልጋል።' : 'Withdrawals require admin approval.'}
          </p>
        </div>
      )}

      {tab === 'history' && (
        <ul className="space-y-2">
          {items.length === 0 && (
            <p className="rounded-2xl border border-white/5 py-12 text-center text-sm text-white/35">
              {am ? 'ገና ተቀማጭ የለም' : 'No deposits yet'}
            </p>
          )}
          {items.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3"
            >
              <div>
                <p className="font-mono font-bold text-gold-400">
                  {Number(d.amount).toFixed(2)} ETB
                </p>
                <p className="text-[10px] text-white/40">{d.merchantOrderId}</p>
              </div>
              <span className="flex items-center gap-1 text-xs uppercase text-white/50">
                {d.status === 'CONFIRMED' && <CheckCircle2 className="h-3.5 w-3.5 text-equb-400" />}
                {d.status === 'PENDING' && <Clock className="h-3.5 w-3.5 text-amber-400" />}
                {d.status === 'FAILED' && <XCircle className="h-3.5 w-3.5 text-red-400" />}
                {d.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
