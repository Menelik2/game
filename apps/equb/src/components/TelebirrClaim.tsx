'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useEqubStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n/LanguageContext';

/** Paste Telebirr transaction number → verify API → credit real wallet balance */
export function TelebirrClaimForm() {
  const user = useEqubStore((s) => s.user);
  const setSessionUser = useEqubStore((s) => s.setSessionUser);
  const refreshBalance = useEqubStore((s) => s.refreshBalance);
  const { locale } = useI18n();
  const am = locale === 'am';
  const [txn, setTxn] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(
    null,
  );

  async function claim() {
    if (!user) {
      setMsg({ type: 'err', text: am ? 'መጀመሪያ ይግቡ' : 'Sign in first' });
      return;
    }
    if (txn.trim().length < 6) {
      setMsg({
        type: 'err',
        text: am ? 'የቴሌብር ግብይት ቁጥር ያስገቡ' : 'Enter Telebirr transaction number',
      });
      return;
    }
    setBusy(true);
    setMsg({
      type: 'info',
      text: am ? 'በ API እየተረጋገጠ ነው…' : 'Checking transaction with API…',
    });
    try {
      const res = await fetch('/api/wallet/deposits/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          transactionNumber: txn.trim(),
        }),
      });
      const json = await res.json();
      if (json.success && (json.status === 'CONFIRMED' || json.balance != null)) {
        setMsg({
          type: 'ok',
          text: am
            ? `ተቀምጧል! +${Number(json.amount || 0).toFixed(2)} ብር · ቀሪ ${Number(json.balance).toFixed(2)} ብር`
            : `Deposited! +${Number(json.amount || 0).toFixed(2)} ETB · balance ${Number(json.balance).toFixed(2)} ETB`,
        });
        if (json.balance != null && Number.isFinite(Number(json.balance))) {
          setSessionUser({ ...user, balance: Number(json.balance) });
        } else {
          refreshBalance();
        }
        setTxn('');
      } else {
        setMsg({
          type:
            json.status === 'PROCESSING' || json.status === 'REVIEW_REQUIRED'
              ? 'info'
              : 'err',
          text:
            json.message || (am ? 'ማረጋገጥ አልተሳካም' : 'Verification failed'),
        });
      }
    } catch {
      setMsg({ type: 'err', text: am ? 'እንደገና ይሞክሩ' : 'Unable to verify' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-500/5 p-4">
      <p className="text-sm font-bold text-amber-100">
        {am ? 'ግብይት ቁጥር ብቻ' : 'Transaction number only'}
      </p>
      <p className="text-xs text-white/45">
        {am
          ? 'ቴሌብር ክፍያ ከላኩ በኋላ የግብይት ቁጥሩን ያስገቡ። API ያረጋግጣልና ሂሳብዎን ይሞላል።'
          : 'After sending Telebirr, paste the transaction number. We check the API and credit your wallet.'}
      </p>
      <input
        value={txn}
        onChange={(e) => setTxn(e.target.value)}
        placeholder="e.g. DET8FJGUJ4"
        className="w-full rounded-xl border border-amber-400/35 bg-black/40 px-4 py-3 font-mono text-sm outline-none focus:border-amber-400"
      />
      <button
        type="button"
        disabled={busy || txn.trim().length < 6}
        onClick={() => void claim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3.5 text-sm font-black text-black disabled:opacity-40"
      >
        <ShieldCheck className="h-4 w-4" />
        {busy
          ? am
            ? 'እየተረጋገጠ…'
            : 'Verifying…'
          : am
            ? 'አረጋግጥ እና አስገባ'
            : 'Verify & deposit'}
      </button>
      {msg && (
        <p
          className={
            msg.type === 'ok'
              ? 'text-sm text-equb-200'
              : msg.type === 'info'
                ? 'text-sm text-amber-100'
                : 'text-sm text-red-200'
          }
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
