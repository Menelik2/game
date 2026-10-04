'use client';

import { useEffect, useRef } from 'react';
import { useEqubStore } from '@/lib/store';

/**
 * Every 60 seconds:
 * 1. Fill empty seats with bots (if anyone joined)
 * 2. Crypto draw → one winner
 * 3. Show result briefly
 * 4. Auto-reopen room + reset timer → new game
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
        if (r && r.status !== 'open') {
          reopenRoom(roomId);
        }
        lock.current = false;
        setTick(60);
      }, delayMs);
    };

    const room = useEqubStore.getState().rooms.find((r) => r.id === roomId);

    if (!room || room.status !== 'open') {
      restart(1200);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const { fillSeats, runDraw, reopenRoom, rooms } = useEqubStore.getState();
        let r = rooms.find((x) => x.id === roomId);
        if (!r || r.status !== 'open') {
          restart(1000);
          return;
        }

        if (r.members.length === 0) {
          if (!cancelled) {
            setMsg(
              locale === 'am'
                ? 'ማንም አልተቀላቀለም — አዲስ ዙር በ1 ደቂቃ'
                : 'No players — new round in 1 minute',
            );
          }
          restart(1000);
          return;
        }

        if (r.members.length < r.groupSize) {
          const res = fillSeats(roomId);
          if (!cancelled) setMsg(res.message);
          r = useEqubStore.getState().rooms.find((x) => x.id === roomId);
        }

        if (!r || r.members.length < r.groupSize) {
          restart(1000);
          return;
        }

        if (!cancelled) setDrawing(true);
        const out = await runDraw(roomId);
        if (cancelled) return;

        setMsg(out.message);
        setDrawing(false);

        setTimeout(() => {
          if (cancelled) return;
          reopenRoom(roomId);
          lock.current = false;
          setTick(60);
          setMsg(
            locale === 'am'
              ? 'አዲስ ዙር ተጀመረ — 60 ሰከንድ'
              : 'New round started — 60 seconds',
          );
        }, 2800);
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

/** Continuous countdown 60 → 0 every second (demo mode) */
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
