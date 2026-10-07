'use client';

import { useEffect, useRef } from 'react';
import { useEqubStore } from '@/lib/store';

/**
 * Offline fallback: at 00:00 draw among real joined players only.
 * One winner. No bots. Then reopen a 60s round.
 */
export function useAutoCryptoDraw(opts: {
  roomId: string | undefined;
  tick: number;
  setTick: (n: number | ((s: number) => number)) => void;
  setMsg: (m: string) => void;
  setDrawing: (d: boolean) => void;
  enabled: boolean;
  locale: 'am' | 'en';
}) {
  const { roomId, tick, setTick, setMsg, setDrawing, enabled, locale } = opts;
  const lock = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (tick !== 0) return;
    if (!roomId) return;
    if (lock.current) return;
    lock.current = true;

    let cancelled = false;

    const restart = (delayMs = 1500) => {
      setTimeout(() => {
        if (cancelled) return;
        const { reopenRoom, rooms } = useEqubStore.getState();
        const r = rooms.find((x) => x.id === roomId);
        if (r && r.status !== 'open') reopenRoom(roomId);
        lock.current = false;
        setTick(60);
      }, delayMs);
    };

    (async () => {
      try {
        const { runDraw, rooms } = useEqubStore.getState();
        const r = rooms.find((x) => x.id === roomId);
        const humans = (r?.members || []).filter(
          (m) => !m.isBot && !String(m.id).startsWith('bot_'),
        );
        if (!r || r.status !== 'open' || humans.length === 0) {
          if (!cancelled) {
            setMsg(
              locale === 'am'
                ? 'ማንም አልተቀላቀለም — አዲስ ዙር'
                : 'No players — new round',
            );
          }
          restart(800);
          return;
        }

        if (!cancelled) setDrawing(true);
        const out = await runDraw(roomId);
        if (cancelled) return;
        setMsg(out.message);
        setDrawing(false);
        setTimeout(() => {
          if (cancelled) return;
          useEqubStore.getState().reopenRoom(roomId);
          lock.current = false;
          setTick(60);
          setMsg(
            locale === 'am'
              ? 'አዲስ ዙር ተጀመረ — 60 ሰከንድ'
              : 'New round started — 60 seconds',
          );
        }, 4000);
      } catch {
        if (!cancelled) {
          setDrawing(false);
          restart(1000);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tick, roomId, enabled, locale, setTick, setMsg, setDrawing]);
}

export function useDemoCountdown(
  tick: number,
  setTick: (n: number | ((s: number) => number)) => void,
  paused: boolean,
) {
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setTick((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [paused, setTick]);
}
