'use client';

import { useEqubStore } from '@/lib/store';
import { verifyDrawProof } from '@/lib/crypto-rng';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { formatBirr, formatBirrSigned, moneyFullLabel } from '@/lib/money';
import { formatEthiopianDateShort } from '@/lib/ethiopian-calendar';
import { EthDateBadge } from '@/components/EthDateBadge';

export default function WalletPage() {
  const user = useEqubStore((s) => s.user);
  const history = useEqubStore((s) => s.history);
  const [verifyMsg, setVerifyMsg] = useState('');
  const { t, locale } = useI18n();

  if (!user) {
    return <p className="py-12 text-center text-white/50">{t.wallet.signInFirst}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t.wallet.title}</h1>
        <EthDateBadge short />
      </div>
      <div className="glass rounded-3xl p-6 text-center">
        <p className="text-xs text-white/40">{t.wallet.virtualBirr}</p>
        <p className="text-4xl font-black text-equb-400">
          {formatBirr(user.balance, locale, { showCode: true })}
        </p>
        <p className="mt-1 text-[10px] text-white/35">{moneyFullLabel(locale)}</p>
      </div>
      <div>
        <h2 className="mb-2 font-semibold">{t.wallet.history}</h2>
        {history.length === 0 && <p className="text-sm text-white/40">{t.wallet.noDraws}</p>}
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
                      groupSize: 0,
                      drawnAt: h.at,
                    });
                    setVerifyMsg(ok ? 'OK' : '…');
                  }}
                >
                  {t.wallet.verify}
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
