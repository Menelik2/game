/**
 * Platform-wide admin settings (in-memory + optional env defaults).
 * Survives warm serverless instances; persist via redeploy/env for cold starts.
 */

export type PlatformSettings = {
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
  updatedAt: string;
  updatedBy?: string | null;
};

const DEFAULTS: PlatformSettings = {
  maintenanceMode: false,
  maintenanceMessage: 'System under maintenance. Please try again later.',
  announcementEnabled: false,
  announcement: '',
  supportPhone: '0977832379',
  supportName: 'Menelik',
  minDepositEtb: 50,
  maxDepositEtb: 100000,
  registrationOpen: true,
  newUserBonusEtb: 100,
  updatedAt: new Date().toISOString(),
  updatedBy: null,
};

const g = globalThis as unknown as { __platformSettings?: PlatformSettings };

function clampMoney(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
}

export function getPlatformSettings(): PlatformSettings {
  if (!g.__platformSettings) {
    g.__platformSettings = { ...DEFAULTS };
  }
  return { ...g.__platformSettings };
}

export function setPlatformSettings(
  patch: Partial<PlatformSettings> & { updatedBy?: string | null },
): PlatformSettings {
  const cur = getPlatformSettings();
  const next: PlatformSettings = {
    ...cur,
    maintenanceMode:
      patch.maintenanceMode !== undefined
        ? Boolean(patch.maintenanceMode)
        : cur.maintenanceMode,
    maintenanceMessage:
      patch.maintenanceMessage !== undefined
        ? String(patch.maintenanceMessage).slice(0, 280)
        : cur.maintenanceMessage,
    announcementEnabled:
      patch.announcementEnabled !== undefined
        ? Boolean(patch.announcementEnabled)
        : cur.announcementEnabled,
    announcement:
      patch.announcement !== undefined
        ? String(patch.announcement).slice(0, 500)
        : cur.announcement,
    supportPhone:
      patch.supportPhone !== undefined
        ? String(patch.supportPhone).replace(/\D/g, '').slice(0, 15)
        : cur.supportPhone,
    supportName:
      patch.supportName !== undefined
        ? String(patch.supportName).slice(0, 80)
        : cur.supportName,
    minDepositEtb:
      patch.minDepositEtb !== undefined
        ? clampMoney(Number(patch.minDepositEtb), 1, 1_000_000)
        : cur.minDepositEtb,
    maxDepositEtb:
      patch.maxDepositEtb !== undefined
        ? clampMoney(Number(patch.maxDepositEtb), 1, 10_000_000)
        : cur.maxDepositEtb,
    registrationOpen:
      patch.registrationOpen !== undefined
        ? Boolean(patch.registrationOpen)
        : cur.registrationOpen,
    newUserBonusEtb:
      patch.newUserBonusEtb !== undefined
        ? clampMoney(Number(patch.newUserBonusEtb), 0, 100_000)
        : cur.newUserBonusEtb,
    updatedAt: new Date().toISOString(),
    updatedBy: patch.updatedBy ?? cur.updatedBy ?? null,
  };
  if (next.minDepositEtb > next.maxDepositEtb) {
    next.maxDepositEtb = next.minDepositEtb;
  }
  g.__platformSettings = next;
  return { ...next };
}

/** Public-safe subset for frontend banner / wallet limits */
export function getPublicPlatformConfig() {
  const s = getPlatformSettings();
  return {
    maintenanceMode: s.maintenanceMode,
    maintenanceMessage: s.maintenanceMode ? s.maintenanceMessage : null,
    announcement:
      s.announcementEnabled && s.announcement.trim()
        ? s.announcement.trim()
        : null,
    supportPhone: s.supportPhone,
    supportName: s.supportName,
    minDepositEtb: s.minDepositEtb,
    maxDepositEtb: s.maxDepositEtb,
    registrationOpen: s.registrationOpen,
  };
}
