'use client';

import { useEffect } from 'react';
import { useEqubStore } from '@/lib/store';

/**
 * Soft client-side deterrents against casual cloning and screenshots.
 * Note: browsers cannot fully block OS-level screenshots or determined attackers.
 */
export function ContentProtection() {
  const user = useEqubStore((s) => s.user);
  const label =
    user && typeof user === 'object'
      ? String(
          (user as { phone?: string; fullName?: string; id?: string }).phone ||
            (user as { fullName?: string }).fullName ||
            (user as { id?: string }).id ||
            '',
        ).slice(0, 24)
      : 'Fast Equb';

  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
    };
    const onDragStart = (e: DragEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'IMG' || t.closest('img'))) {
        e.preventDefault();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      // Block common inspect / save / print shortcuts
      if (
        key === 'f12' ||
        (ctrl && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) ||
        (ctrl && (key === 'u' || key === 's' || key === 'p'))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onCopy = (e: ClipboardEvent) => {
      const sel = window.getSelection()?.toString() || '';
      // Allow copy inside inputs/textareas only
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || el?.isContentEditable) return;
      if (sel.length > 0) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', onContext);
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('copy', onCopy);

    return () => {
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('copy', onCopy);
    };
  }, []);

  return (
    <>
      {/* Invisible watermark layer — shows in many screenshots / print */}
      <div
        className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden select-none"
        aria-hidden
      >
        <div className="absolute inset-0 opacity-[0.045]">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="absolute whitespace-nowrap text-[11px] font-bold tracking-[0.35em] text-white"
              style={{
                top: `${(i % 6) * 18 + 8}%`,
                left: `${Math.floor(i / 6) * 28 - 10}%`,
                transform: 'rotate(-28deg)',
              }}
            >
              {label} · FAST EQUB · PROTECTED
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
