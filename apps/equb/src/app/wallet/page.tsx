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

type Withdrawal = {
  id: string;
  amount: number;
  status: string;
  payoutPhone: string;
  createdAt: string;
  adminNote?: string | null;
};

const PRESETS = [50, 100, 200, 500, 1000, 2000];
const WD_PRESETS = [50, 100, 200, 500, 1000];

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
  const [wdAmount, setWdAmount] = useState('100');
  const [wdPhone, setWdPhone] = useState('');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [wdMin, setWdMin] = useState(50);

  const flash = (type: 'ok' | 'err' | 'info', text: string) => {
    setMsg({ type, text });
  };

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(
        `/api/wallet/deposits?userId=${encodeURIComponent(user.id)}`,
        { cache: 'no-store', credentials: 'include' },
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
    try {
      const wr = await fetch(
        `/api/wallet/withdrawals?userId=${encodeURIComponent(user.id)}`,
        { cache: 'no-store', credentials: 'include' },
      );
      const wj = await wr.json().catch(() => ({}));
      if (wj?.success) {
        setWithdrawals(wj.withdrawals || []);
        if (wj.config?.minWithdraw) setWdMin(Number(wj.config.minWithdraw));
      }
    } catch {
      /* ignore */
    }
    refreshBalance();
  }, [user, setSessionUser, refreshBalance]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (user?.phone && !wdPhone) setWdPhone(user.phone);
  }, [user?.phone, wdPhone]);

  async function requestWithdraw() {
    if (!user) {
      flash('err', am ? 'መጀመሪያ ይግቡ' : 'Sign in first');
      return;
    }
    const amt = Number(wdAmount);
    if (!Number.isFinite(amt) || amt < wdMin) {
      flash('err', am ? `ዝቅተኛው ${wdMin} ብር ነው` : `Minimum is ${wdMin} ETB`);
      return;
    }
    if (amt > Number(user.balance || 0)) {
      flash('err', am ? 'በቂ ቀሪ ሂሳብ የለም' : 'Insufficient balance');
      return;
    }
    const phone = (wdPhone || user.phone || '').trim();
    if (!phone) {
      flash('err', am ? 'የቴሌብር ቁጥር ያስገቡ' : 'Enter your Telebirr number');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/wallet/withdrawals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: amt,
          payoutPhone: phone,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        const m =
          json.message ||
          (res.status === 401
            ? am
              ? 'እባክዎ እንደገና ይግቡ'
              : 'Please sign in again'
            : am
              ? 'ማውጣት አልተሳካም'
              : 'Withdraw failed');
        flash('err', m);
        return;
      }
      if (json.balance != null) {
        setSessionUser({ ...user, balance: Number(json.balance) });
      }
      flash(
        'ok',
        am
          ? 'ጥያቄ ተልኳል። አድሚን ወደ ቴሌብርዎ ይከፍላል።'
          : 'Request sent. Admin will pay your Telebirr.',
      );
      setWdAmount('100');
      await load();
    } catch {
      flash('err', am ? 'አውታረ መረብ ስህተት' : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  async function createDeposit() {
    if (!user) {
      flash('err', am ? 'መጀመሪያ ይግቡ' : 'Sign in first');
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 10) {
      flash('err', am ? 'ዝቅተኛው 10 ብር ነው' : 'Minimum is 10 ETB');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/wallet/deposits', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: amt,
          paymentMethod: 'telebirr',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        flash('err', json.message || (am ? 'ትዕዛዝ አልተሳካም' : 'Order failed'));
        return;
      }
      setDeposit(json.deposit);
      setStep(2);
      flash(
        'ok',
        am
          ? 'ትዕዛዝ ተፈጥሯል። ቴሌብር ይላኩ፣ ከዚያ የግብይት ቁጥር ያስገቡ።'
          : 'Order created. Send Telebirr, then paste the transaction number.',
      );
      await load();
    } catch {
      flash('err', am ? 'አውታረ መረብ ስህተት' : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  async function verifyTxn() {
    if (!user || !deposit) return;
    const transactionNumber = txn.trim();
    if (!transactionNumber) {
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
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          transactionNumber,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.success && json.status === 'CONFIRMED') {
        if (json.balance != null) {
          setSessionUser({ ...user, balance: Number(json.balance) });
        }
        flash('ok', am ? 'ተረጋግጧል! ቀሪ ሂሳብ ተጨምሯል።' : 'Confirmed! Balance updated.');
        setStep(3);
        setTxn('');
        await load();
      } else {
        flash(
          'err',
          json.message ||
            (am ? 'ማረጋገጥ አልተሳካም — አድሚን ያጣራ' : 'Verify failed — admin review'),
        );
      }
    } catch {
      flash('err', am ? 'አውታረ መረብ ስህተት' : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, kind: 'phone' | 'name') {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  if (!user) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <WalletIcon className="h-12 w-12 text-white/30" />
        <p className="text-center text-white/60">
          {am ? 'የኪስ ቦርሳ ለመጠቀም ይግቡ' : 'Sign in to use wallet'}
        </p>
        <Link href="/profile" className="btn-gold px-6 py-2.5">
          {am ? 'ግባ' : 'Sign in'}
        </Link>
      </div>
    );
  }

  const phone = cfg?.merchantPhone || '0977832379';
  const name = cfg?.merchantName || 'Menelik';

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-24">
      <div className="glass relative overflow-hidden rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-equb-500 text-lg font-black text-white">
              {(user.name || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-bold text-white">{user.name}</p>
              <p className="truncate text-xs text-white/45">{user.phone}</p>
            </div>
          </div>
          <EthDateBadge short />
        </div>
        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
            {am ? 'ቀሪ ሂሳብ' : 'BALANCE'}
          </p>
          <LiveBalance size="lg" />
        </div>
      </div>

      <div className="flex gap-1 rounded-2xl border border-white/10 bg-black/30 p-1">
        {(
          [
            { id: 'deposit' as const, label: am ? 'አስገባ' : 'Deposit', icon: ArrowDownToLine },
            { id: 'withdraw' as const, label: am ? 'አውጣ' : 'Withdraw', icon: ArrowUpFromLine },
            { id: 'history' as const, label: am ? 'ታሪክ' : 'History', icon: History },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={clsx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition',
              tab === id
                ? 'bg-amber-400 text-black shadow-md'
                : 'text-white/50 hover:text-white/80',
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
            'rounded-xl border px-3 py-2.5 text-sm',
            msg.type === 'ok' && 'border-equb-500/30 bg-equb-500/10 text-equb-100',
            msg.type === 'err' && 'border-red-500/30 bg-red-500/10 text-red-200',
            msg.type === 'info' && 'border-amber-500/30 bg-amber-500/10 text-amber-100',
          )}
        >
          {msg.text}
        </p>
      )}

      {tab === 'deposit' && (
        <div className="space-y-4">
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
                      'rounded-xl border py-2 text-sm font-bold',
                      Number(amount) === p
                        ? 'border-amber-400 bg-amber-400/20 text-amber-100'
                        : 'border-white/10 text-white/70',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-white"
                placeholder="Amount ETB"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void createDeposit()}
                className="btn-gold w-full py-2.5 disabled:opacity-40"
              >
                {am ? 'ትዕዛዝ ፍጠር' : 'Create order'}
              </button>
              {deposit && (
                <div className="space-y-2">
                  <p className="text-xs text-white/50">
                    Order: <span className="font-mono text-amber-200">{deposit.merchantOrderId}</span>
                  </p>
                  <input
                    value={txn}
                    onChange={(e) => setTxn(e.target.value)}
                    placeholder={am ? 'የግብይት ቁጥር' : 'Transaction number'}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-white"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void verifyTxn()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-equb-500/40 bg-equb-500/20 py-2.5 text-sm font-bold text-equb-100"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {am ? 'በትዕዛዝ አረጋግጥ' : 'Verify against order'}
                  </button>
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      {tab === 'withdraw' && (
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-white/50">
            {am
              ? 'ክፍያ ወደ የእርስዎ ቴሌብር ቁጥር ይሄዳል። አድሚን ከነጋዴ ቴሌብር ይልካል።'
              : 'Payout goes to YOUR Telebirr number. Admin sends from merchant Telebirr. Balance is held until paid or rejected.'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {WD_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setWdAmount(String(p))}
                className={clsx(
                  'rounded-xl border py-2 text-sm font-bold',
                  Number(wdAmount) === p
                    ? 'border-amber-400 bg-amber-400/20 text-amber-100'
                    : 'border-white/10 text-white/70',
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={wdAmount}
            onChange={(e) => setWdAmount(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-white"
            placeholder={am ? 'መጠን' : 'Amount'}
          />
          <label className="block text-xs text-white/50">
            {am ? 'የቴሌብር ቁጥርዎ (ለመቀበል)' : 'Your Telebirr number (to receive)'}
            <input
              value={wdPhone}
              onChange={(e) => setWdPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-white"
              placeholder="09…"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void requestWithdraw()}
            className="btn-gold w-full py-3 disabled:opacity-40"
          >
            {am ? 'አውጣ' : 'Withdraw'}
          </button>
        </div>
      )}

      {tab === 'history' && (
        <ul className="space-y-2">
          {items.length === 0 && withdrawals.length === 0 && (
            <p className="py-8 text-center text-sm text-white/40">
              {am ? 'ታሪክ የለም' : 'No history yet'}
            </p>
          )}
          {items.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-semibold text-white">
                  +{d.amount} ETB
                </p>
                <p className="text-[10px] text-white/40">{d.createdAt}</p>
              </div>
              <span
                className={clsx(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                  d.status === 'CONFIRMED' && 'bg-equb-500/20 text-equb-300',
                  d.status === 'PENDING' && 'bg-amber-500/20 text-amber-200',
                  d.status === 'FAILED' && 'bg-red-500/20 text-red-200',
                )}
              >
                {d.status === 'CONFIRMED' && <CheckCircle2 className="h-3 w-3" />}
                {d.status === 'PENDING' && <Clock className="h-3 w-3" />}
                {d.status === 'FAILED' && <XCircle className="h-3 w-3" />}
                {d.status}
              </span>
            </li>
          ))}
          {withdrawals.map((w) => (
            <li
              key={w.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-semibold text-white">
                  −{w.amount} ETB
                </p>
                <p className="text-[10px] text-white/40">{w.createdAt}</p>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-white/60">
                {w.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
