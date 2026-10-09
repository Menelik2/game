'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Megaphone } from 'lucide-react';

type Config = {
  maintenanceMode?: boolean;
  maintenanceMessage?: string | null;
  announcement?: string | null;
};

export function SiteBanner() {
  const [cfg, setCfg] = useState<Config | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await fetch('/api/system/config', { cache: 'no-store' });
        const json = await res.json();
        if (!c && json.success) setCfg(json.data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  if (!cfg) return null;

  if (cfg.maintenanceMode && cfg.maintenanceMessage) {
    return (
      <div className="mb-3 flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/15 px-3 py-2.5 text-xs text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <p className="leading-relaxed">{cfg.maintenanceMessage}</p>
      </div>
    );
  }

  if (cfg.announcement) {
    return (
      <div className="mb-3 flex items-start gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2.5 text-xs text-cyan-100">
        <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
        <p className="leading-relaxed">{cfg.announcement}</p>
      </div>
    );
  }

  return null;
}
