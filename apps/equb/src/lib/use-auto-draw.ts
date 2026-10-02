'use client';

import { useEffect, useRef } from 'react';
import { useEqubStore } from '@/lib/store';

/**
 * When countdown hits 0: fill remaining seats with bots, then run crypto draw.
 * Resets timer to 60s after the draw.
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

    const room = useEqubStore.getState().rooms.find((r) => r.id === roomId);
    if (!room || room.status !== 'open') {
      const t = setTimeout(() => {
        lock.current = false;
        setTick(60);
      }, 1500);
      return () => clearTimeout(t);
    }

    let cancelled = false;

    (async () => {
      try {
        const { fillSeats, runDraw, rooms } = useEqubStore.getState();
        let r = rooms.find((x) => x.id === roomId);
        if (!r || r.status !== 'open') {
          lock.current = false;
          return;
        }

        if (r.members.length === 0) {
          if (!cancelled) {
            setMsg(
              locale === 'am'
                ? 'ማንም አልተቀላቀለም — ሰዓት እንደገና'
                : 'No players joined — timer reset',
            );
            lock.current = false;
            setTick(60);
          }
          return;
        }

        if (r.members.length < r.groupSize) {
          const res = fillSeats(roomId);
          if (!cancelled) setMsg(res.message);
          r = useEqubStore.getState().rooms.find((x) => x.id === roomId);
        }

        if (!r || r.status !== 'open' || r.members.length < r.groupSize) {
          if (!cancelled) {
            lock.current = false;
            setTick(60);
          }
          return;
        }

        if (!cancelled) setDrawing(true);
        const out = await runDraw(roomId);
        if (!cancelled) {
          setMsg(out.message);
          setDrawing(false);
          setTimeout(() => {
            lock.current = false;
            setTick(60);
          }, 2500);
        }
      } catch {
        if (!cancelled) {
          setDrawing(false);
          lock.current = false;
          setTick(60);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tick, roomId, enabled, locale, setTick, setMsg, setDrawing]);
}

/** Demo countdown 60 → 0 */
export function useDemoCountdown(
  _tick: number,
  setTick: (n: number | ((s: number) => number)) => void,
  paused: boolean,
) {
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setTick((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [paused, setTick]);
}
