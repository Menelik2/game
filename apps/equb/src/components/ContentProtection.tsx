'use client';

import { useEffect } from 'react';

/**
 * Soft client-side deterrents against casual cloning and screenshots.
 * Watermark shows brand only — never personal data.
 */
export function ContentProtection() {
  const label = 'ፈጣን ቢንጎ';

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
      <div
        className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden select-none"
        aria-hidden
      >
        <div className="absolute inset-0 opacity-[0.04]">
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
              {label} · FAST BINGO
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
