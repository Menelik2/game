'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEqubStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { Copy, ExternalLink } from 'lucide-react';

type Cfg = {
  merchantName: string;
  merchantPhone: string;
  checkoutAvailable: boolean;
  instruction: string;
  environment: string;
  verifier?: string;
};

type Deposit = {
  id: string;
  amount: number;
  status: string;
  merchantOrderId: string;
  createdAt: string;
  failureReason: string | null;
};

export default function WalletPage() {
  const user = useEqubStore((s) => s.user);
  const setSessionUser = useEqubStore((s) => s.setSessionUser);
  const refreshBalance = useEqubStore((s) => s.refreshBalance);
  const { locale } = useI18n();
  const [tab, setTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [amount, setAmount] = useState('100.00');
  const [txn, setTxn] = useState('');
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [items, setItems] = useState<Deposit[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);

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
        // Sync session balance from server (do not overwrite with 0)
        if (
          json.wallet?.balance != null &&
          Number.isFinite(Number(json.wallet.balance))
        ) {
          const serverBal = Number(json.wallet.balance);
          // Prefer higher of session vs server only when server is authoritative (DB)
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

  async function start() {
    if (!user) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/wallet/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: Number(amount),
          paymentMethod: 'telebirr',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setMsg(json.message || 'Could not create deposit');
        return;
      }
      setDeposit(json.deposit);
      setMsg(
        locale === 'am'
          ? 'ትዕዛዝ ተፈጥሯል። ቴሌብር ይላኩ፣ ከዚያ የግብይት ቁጥር ያስገቡ።'
          : 'Order created. Send Telebirr, then paste the transaction number.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!user || !deposit) {
      setMsg('Create the deposit first');
      return;
    }
    if (!txn.trim() || txn.trim().length < 6) {
      setMsg(
        locale === 'am'
          ? 'የቴሌብር ግብይት ቁጥር ያስገቡ'
          : 'Enter Telebirr transaction number',
      );
      return;
    }
    setBusy(true);
    setMsg(locale === 'am' ? 'በ Verify.ET እየተረጋገጠ ነው…' : 'Verifying with Verify.ET…');
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
      setMsg(json.message || 'Unable to verify the payment right now.');

      // Server already credited — set absolute balance (no double +delta)
      if (json.success && json.status === 'CONFIRMED') {
        if (json.balance != null && Number.isFinite(Number(json.balance))) {
          setSessionUser({ ...user, balance: Number(json.balance) });
        } else {
          refreshBalance();
        }
        setTxn('');
        setDeposit(null);
      }
      await load();
    } catch {
      setMsg('Unable to verify the payment right now. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <p className="py-12 text-center text-white/50">
        {locale === 'am' ? 'መጀመሪያ ይግቡ' : 'Sign in first'}
      </p>
    );
  }

  const shown = Number(user.balance) || 0;
  const phone = cfg?.merchantPhone || '0977832379';
  const name = cfg?.merchantName || 'Menelik';

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-10">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold">{user.name}</p>
          <p className="text-xs text-white/45">{user.phone}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-amber-400">BALANCE</p>
          <p className="text-2xl font-black">{shown.toFixed(2)} ETB</p>
          <p className="text-[11px] text-white/40">
            Withdrawable: {shown.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 rounded-2xl bg-white/5 p-1">
        {(['deposit', 'withdraw', 'history'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              tab === k
                ? 'rounded-xl bg-amber-400 py-2.5 text-sm font-black text-black'
                : 'py-2.5 text-sm text-white/70'
            }
          >
            {k === 'deposit' ? 'Deposit' : k === 'withdraw' ? 'Withdraw' : 'History'}
          </button>
        ))}
      </div>

      {tab === 'deposit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
            <span className="font-semibold">Telebirr</span>
            <a
              href="https://verify.et/verify/telebirr"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-amber-300"
            >
              Verify.ET <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <p>
                Send payment to:{' '}
                <span className="text-xl font-black underline">{phone}</span>
              </p>
              <button
                type="button"
                className="rounded-xl bg-amber-400 p-2 text-black"
                onClick={() => {
                  void navigator.clipboard.writeText(phone);
                  setCopied(true);
                }}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            {copied && <p className="text-[11px] text-amber-300">Copied</p>}
            <p className="mt-2 text-sm">
              Telebirr account name: <b>{name}</b>
            </p>
            <p className="mt-2 text-xs text-white/45">
              {cfg?.instruction ||
                'Complete your Telebirr payment and verify the transaction with Verify.ET.'}
            </p>
          </div>

          <label className="block text-xs text-white/50">
            Amount (ETB)
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm"
            />
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={() => void start()}
            className="w-full rounded-2xl border border-white/15 py-3 text-sm font-bold"
          >
            Create deposit order
          </button>

          <label className="block text-xs text-white/50">
            Telebirr transaction number
            <input
              value={txn}
              onChange={(e) => setTxn(e.target.value)}
              placeholder="e.g. DET8FJGUJ4"
              className="mt-1 w-full rounded-2xl border border-amber-400/30 bg-black/40 px-4 py-3 text-sm"
            />
          </label>

          <button
            type="button"
            disabled={busy || !deposit}
            onClick={() => void verify()}
            className="w-full rounded-2xl bg-amber-400 py-3.5 font-black text-black disabled:opacity-40"
          >
            {busy ? 'Verifying…' : 'Verify with Verify.ET'}
          </button>

          {msg && <p className="text-center text-sm text-amber-200">{msg}</p>}
          <p className="text-center text-[11px] text-white/35">
            Wallet is credited only after Verify.ET confirms the receipt and amount.
          </p>
        </div>
      )}

      {tab === 'withdraw' && (
        <p className="rounded-2xl border border-white/10 p-4 text-sm text-white/55">
          Withdrawals require admin approval.
        </p>
      )}

      {tab === 'history' && (
        <ul className="space-y-2">
          {items.length === 0 && (
            <p className="text-sm text-white/40">No deposits yet</p>
          )}
          {items.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-white/10 px-3 py-2 text-sm"
            >
              <div className="flex justify-between">
                <span>+{Number(d.amount).toFixed(2)} ETB</span>
                <span>{d.status}</span>
              </div>
              <p className="text-[11px] text-white/40">{d.merchantOrderId}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
