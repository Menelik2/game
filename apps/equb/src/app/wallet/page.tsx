'use client';

import { useEqubStore } from '@/lib/store';
import { verifyDrawProof } from '@/lib/crypto-rng';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { formatBirrSigned, moneyFullLabel } from '@/lib/money';
import { formatEthiopianDateShort } from '@/lib/ethiopian-calendar';
import { EthDateBadge } from '@/components/EthDateBadge';
import { LiveBalance } from '@/components/LiveBalance';

type PayConfig = {
  mode: string;
  provider: string;
  realMoneyLive: boolean;
  currency: string;
  minDeposit: number;
  maxDeposit: number;
  note: string;
};

const AMOUNTS = [50, 100, 200, 500, 1000];

export default function WalletPage() {
  const user = useEqubStore((s) => s.user);
  const history = useEqubStore((s) => s.history);
  const refreshBalance = useEqubStore((s) => s.refreshBalance);
  const [verifyMsg, setVerifyMsg] = useState('');
  const [cfg, setCfg] = useState<PayConfig | null>(null);
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const [payMsg, setPayMsg] = useState('');
  const { t, locale } = useI18n();

  const loadCfg = useCallback(async () => {
    try {
      const res = await fetch('/api/payments/status');
      const json = await res.json();
      if (json?.success) setCfg(json.data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadCfg();
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search);
      if (q.get('deposit') === 'done' || q.get('deposit') === 'return') {
        setPayMsg(
          locale === 'am'
            ? 'ክፍያ ከተረጋገጠ ቀሪ ሂሳብ ይዘምናል'
            : 'If payment was confirmed, balance will update shortly',
        );
        refreshBalance();
      }
    }
  }, [loadCfg, locale, refreshBalance]);

  async function startDeposit() {
    if (!user) return;
    setBusy(true);
    setPayMsg('');
    try {
      const res = await fetch('/api/payments/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount,
          name: user.name,
          phone: user.phone,
          returnUrl:
            typeof window !== 'undefined'
              ? `${window.location.origin}/wallet?deposit=return`
              : '',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setPayMsg(json?.message || 'Deposit failed');
        return;
      }
      const url = json?.data?.redirectUrl as string | undefined;
      if (url) {
        window.location.href = url;
        return;
      }
      setPayMsg('No checkout URL returned');
    } catch {
      setPayMsg('Network error');
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t.wallet.title}</h1>
        <EthDateBadge short />
      </div>

      <div className="glass rounded-3xl p-6 text-center">
        <p className="text-xs text-white/40">{t.wallet.virtualBirr}</p>
        <div className="mt-2 flex justify-center">
          <LiveBalance size="lg" />
        </div>
        <p className="mt-1 text-[10px] text-white/35">{moneyFullLabel(locale)}</p>
      </div>

      <div className="glass space-y-4 rounded-3xl p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">
              {locale === 'am' ? 'ገንዘብ አስገባ' : 'Deposit'}
            </h2>
            <p className="mt-1 text-[11px] text-white/45">
              {cfg?.note || (locale === 'am' ? 'ክፍያ ሁኔታ…' : 'Loading…')}
            </p>
          </div>
          <span
            className={
              cfg?.realMoneyLive
                ? 'rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300'
                : 'rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/50'
            }
          >
            {cfg?.realMoneyLive ? cfg.provider.toUpperCase() : 'DEMO'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(a)}
              className={
                amount === a
                  ? 'rounded-full bg-equb-500/30 px-3 py-1.5 text-xs font-bold text-equb-300'
                  : 'rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/60'
              }
            >
              {a} {cfg?.currency || 'ETB'}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            min={cfg?.minDeposit || 10}
            max={cfg?.maxDeposit || 50000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="flex-1 rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
          />
          <button
            type="button"
            disabled={busy || !cfg?.realMoneyLive}
            onClick={() => void startDeposit()}
            className="btn-gold px-5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? '…' : locale === 'am' ? 'ክፈል' : 'Pay'}
          </button>
        </div>

        {!cfg?.realMoneyLive && (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200/90">
            {locale === 'am'
              ? 'እውነተኛ ክፍያ ጠፍቷል። ፈቃድ ካገኙ በኋላ REAL_MONEY_ENABLED + CHAPA_SECRET_KEY ያዘጋጁ።'
              : 'Real payments are off until REAL_MONEY_ENABLED + CHAPA_SECRET_KEY (after licenses). Virtual Birr only.'}
          </p>
        )}

        {payMsg && <p className="text-xs text-equb-300">{payMsg}</p>}
      </div>

      <div>
        <h2 className="mb-2 font-semibold">{t.wallet.history}</h2>
        {history.length === 0 && (
          <p className="text-sm text-white/40">{t.wallet.noDraws}</p>
        )}
        <ul className="space-y-2">
          {history.map((h, i) => (
            <li key={i} className="glass rounded-xl px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span>
                  #{h.winningNumber} · {h.winnerName}
                  {h.wasYou ? ` (${t.wallet.you})` : ''}
                </span>
                <span className={h.wasYou ? 'text-gold-400' : 'text-white/40'}>
                  {h.wasYou ? formatBirrSigned(h.amount, locale) : '—'}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-white/30">
                {formatEthiopianDateShort(h.at, locale)}
              </p>
              {h.entropyHex && h.commitmentHash && (
                <button
                  type="button"
                  className="mt-1 text-[10px] text-equb-400 underline"
                  onClick={async () => {
                    const ok = await verifyDrawProof({
                      winningNumber: h.winningNumber,
                      entropyHex: h.entropyHex!,
                      commitmentHash: h.commitmentHash!,
                      groupSize: 100,
                    });
                    setVerifyMsg(ok ? 'Proof OK' : 'Proof failed');
                  }}
                >
                  Verify RNG
                </button>
              )}
            </li>
          ))}
        </ul>
        {verifyMsg && <p className="mt-2 text-xs text-white/50">{verifyMsg}</p>}
      </div>
    </div>
  );
}
