'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import {
  Settings,
  Save,
  Megaphone,
  Wrench,
  Percent,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';

type Platform = {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcementEnabled: boolean;
  announcement: string;
  supportPhone: string;
  supportName: string;
  minDepositEtb: number;
  maxDepositEtb: number;
  registrationOpen: boolean;
  newUserBonusEtb: number;
  updatedAt?: string;
};

type Prize = {
  platformFeeRate: number;
  updatedAt?: string;
};

export default function AdminSettingsPage() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [prize, setPrize] = useState<Prize | null>(null);
  const [feePercent, setFeePercent] = useState('15');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/settings');
      const json = await res.json();
      if (json.success) {
        setPlatform(json.data.platform);
        setPrize(json.data.prize);
        setFeePercent(
          String(
            Math.round(Number(json.data.prize?.platformFeeRate || 0.15) * 1000) /
              10,
          ),
        );
        setMsg(null);
      } else {
        setMsg({ type: 'err', text: json.message || 'Load failed' });
      }
    } catch (e) {
      setMsg({
        type: 'err',
        text: e instanceof Error ? e.message : 'Load failed',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePlatform() {
    if (!platform) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ section: 'platform', ...platform }),
      });
      const json = await res.json();
      if (!json.success) {
        setMsg({ type: 'err', text: json.message || 'Save failed' });
      } else {
        setPlatform(json.data.platform);
        setMsg({ type: 'ok', text: 'Platform settings saved' });
      }
    } catch (e) {
      setMsg({
        type: 'err',
        text: e instanceof Error ? e.message : 'Save failed',
      });
    } finally {
      setBusy(false);
    }
  }

  async function savePrize() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({
          section: 'prize',
          feePercent: Number(feePercent),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setMsg({ type: 'err', text: json.message || 'Save failed' });
      } else {
        setPrize(json.data.prize);
        setMsg({ type: 'ok', text: json.message || 'Fee saved' });
      }
    } catch (e) {
      setMsg({
        type: 'err',
        text: e instanceof Error ? e.message : 'Save failed',
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading || !platform) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-16">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-black text-amber-50">
          <Settings className="h-5 w-5 text-amber-400" />
          Platform Settings
        </h2>
        <p className="mt-1 text-xs text-white/45">
          Maintenance · announcements · deposits · platform fee
        </p>
      </div>

      {msg && (
        <p
          className={clsx(
            'rounded-xl border px-3 py-2 text-xs',
            msg.type === 'ok'
              ? 'border-equb-500/30 bg-equb-500/10 text-equb-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200',
          )}
        >
          {msg.text}
        </p>
      )}

      {/* Maintenance */}
      <section className="space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <Wrench className="h-4 w-4 text-amber-400" />
          Maintenance mode
        </h3>
        <label className="flex items-center gap-3 text-sm text-white/70">
          <input
            type="checkbox"
            checked={platform.maintenanceMode}
            onChange={(e) =>
              setPlatform({ ...platform, maintenanceMode: e.target.checked })
            }
            className="h-4 w-4 rounded border-white/20"
          />
          Block players (show maintenance message)
        </label>
        <textarea
          value={platform.maintenanceMessage}
          onChange={(e) =>
            setPlatform({ ...platform, maintenanceMessage: e.target.value })
          }
          rows={2}
          className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm text-white"
          placeholder="Maintenance message"
        />
      </section>

      {/* Announcement */}
      <section className="space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <Megaphone className="h-4 w-4 text-cyan-400" />
          Site announcement banner
        </h3>
        <label className="flex items-center gap-3 text-sm text-white/70">
          <input
            type="checkbox"
            checked={platform.announcementEnabled}
            onChange={(e) =>
              setPlatform({
                ...platform,
                announcementEnabled: e.target.checked,
              })
            }
            className="h-4 w-4 rounded border-white/20"
          />
          Show banner to all users
        </label>
        <textarea
          value={platform.announcement}
          onChange={(e) =>
            setPlatform({ ...platform, announcement: e.target.value })
          }
          rows={2}
          className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm text-white"
          placeholder="e.g. New rooms live every minute · Play fair"
        />
      </section>

      {/* Registration & deposits */}
      <section className="space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4">
        <h3 className="text-sm font-bold text-white">Registration & deposits</h3>
        <label className="flex items-center gap-3 text-sm text-white/70">
          <input
            type="checkbox"
            checked={platform.registrationOpen}
            onChange={(e) =>
              setPlatform({ ...platform, registrationOpen: e.target.checked })
            }
            className="h-4 w-4 rounded border-white/20"
          />
          New user registration open
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-white/50">
            Min deposit (ETB)
            <input
              type="number"
              value={platform.minDepositEtb}
              onChange={(e) =>
                setPlatform({
                  ...platform,
                  minDepositEtb: Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/50">
            Max deposit (ETB)
            <input
              type="number"
              value={platform.maxDepositEtb}
              onChange={(e) =>
                setPlatform({
                  ...platform,
                  maxDepositEtb: Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/50">
            New user bonus (ETB)
            <input
              type="number"
              value={platform.newUserBonusEtb}
              onChange={(e) =>
                setPlatform({
                  ...platform,
                  newUserBonusEtb: Number(e.target.value),
                })
              }
              className="mt-1 w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-white/50">
            Support phone
            <input
              value={platform.supportPhone}
              onChange={(e) =>
                setPlatform({ ...platform, supportPhone: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2 font-mono text-sm text-white"
            />
          </label>
          <label className="block text-xs text-white/50">
            Support name
            <input
              value={platform.supportName}
              onChange={(e) =>
                setPlatform({ ...platform, supportName: e.target.value })
              }
              className="mt-1 w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void savePlatform()}
          className="flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"
        >
          <Save className="h-4 w-4" />
          {busy ? 'Saving…' : 'Save platform settings'}
        </button>
      </section>

      {/* Prize fee */}
      <section className="space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <Percent className="h-4 w-4 text-gold-400" />
          Platform fee (profit cut)
        </h3>
        <p className="text-xs text-white/40">
          Current:{' '}
          {((prize?.platformFeeRate ?? 0.15) * 100).toFixed(1)}% of each pot
        </p>
        <label className="block text-xs text-white/50">
          Fee percent (0–50)
          <input
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={feePercent}
            onChange={(e) => setFeePercent(e.target.value)}
            className="mt-1 w-full max-w-xs rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm text-white"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void savePrize()}
          className="flex items-center gap-2 rounded-xl border border-gold-500/40 bg-gold-500/15 px-4 py-2.5 text-sm font-bold text-gold-200 disabled:opacity-40"
        >
          <Save className="h-4 w-4" />
          Save fee
        </button>
      </section>
    </div>
  );
}
