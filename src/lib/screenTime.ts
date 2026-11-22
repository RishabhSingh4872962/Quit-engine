import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import ScreenTime from '../../modules/screen-time';
import { reportError } from './telemetry';

/**
 * Daily time in chosen apps, read on the phone from Android's Usage access.
 * Nothing here is stored, backed up or sent to analytics.
 */

export const screenTimeAvailable = Platform.OS === 'android' && ScreenTime !== null;

export interface DayUsage {
  start: number; // local midnight, epoch ms
  byApp: Record<string, number>; // package id -> ms in the foreground
}

/** Local midnights for the last `days` days (oldest first), plus the coming midnight. */
function dayBoundaries(days: number): number[] {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const out: number[] = [];
  for (let i = days - 1; i >= -1; i--) {
    const d = new Date(midnight);
    d.setDate(midnight.getDate() - i); // setDate keeps local midnight even across DST changes
    out.push(d.getTime());
  }
  return out;
}

export const openUsageAccessSettings = () => ScreenTime?.openUsageAccessSettings();

/** Per-day usage of `packages` for the last `days` days (today last), or null without access. */
async function readUsage(packages: string[], days: number): Promise<DayUsage[] | null> {
  if (!ScreenTime?.hasUsageAccess()) return null;
  const bounds = dayBoundaries(days);
  const perDay = await ScreenTime.getForegroundTime(packages, bounds);
  return perDay.map((byApp, i) => ({ start: bounds[i], byApp }));
}

/**
 * Usage for the last `days` days including today (today is the last entry).
 * Re-reads when the app comes back to the foreground, e.g. from the Usage access screen.
 */
export function useScreenTime(packages: string[], days = 8) {
  const [access, setAccess] = useState(() => ScreenTime?.hasUsageAccess() ?? false);
  const [usage, setUsage] = useState<DayUsage[] | null>(null);
  const key = packages.join(',');

  useEffect(() => {
    let mounted = true;
    const load = () =>
      readUsage(key.split(','), days)
        .then((u) => mounted && u && setUsage(u))
        .catch((e: unknown) => reportError(e, 'screen time'));
    void load();
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || !ScreenTime) return;
      setAccess(ScreenTime.hasUsageAccess()); // may have just been turned on in settings
      void load();
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [key, days]);

  return { access, usage };
}
