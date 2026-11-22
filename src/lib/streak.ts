import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export const DAY_MS = 86_400_000;

/** Whole days since the streak started (never negative, even if `now` is slightly stale). */
export const streakDays = (start: number | null, now: number) =>
  start === null ? 0 : Math.max(0, Math.floor((now - start) / DAY_MS));

/**
 * Where the streak sits between milestones. `progress` (0–1) is fractional, so the ring
 * fills smoothly through the day instead of jumping at midnight.
 */
export function milestoneProgress(start: number | null, milestones: number[], now: number) {
  const exact = start === null ? 0 : Math.max(0, (now - start) / DAY_MS);
  const days = Math.floor(exact);
  const next = milestones.find((m) => m > days);
  const prev = [...milestones].reverse().find((m) => m <= days) ?? 0;
  const progress = next === undefined ? 1 : (exact - prev) / (next - prev);
  return { days, next, prev, progress: Math.min(1, Math.max(0, progress)) };
}

/** Current time, refreshed every `intervalMs` and whenever the app comes back to the foreground. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [intervalMs]);
  return now;
}
