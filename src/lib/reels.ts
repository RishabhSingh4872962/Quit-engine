import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import ReelGuard from '../../modules/reel-guard';
import type { ReelDay } from '../../modules/reel-guard';
import { storage } from './storage';
import { reportError } from './telemetry';

/**
 * Reel counting (Android): a native Accessibility Service counts reels/shorts in a few apps.
 * Only per-day totals are kept, on the phone. No analytics: it would reveal the Reels habit.
 */

export type { ReelDay };
export const reelCounterAvailable = Platform.OS === 'android' && ReelGuard !== null;

const CONSENT_KEY = 'reels.consentAt'; // when the user agreed on the disclosure screen (Play policy)

export const readReelConsent = () => storage.getNumber(CONSENT_KEY);
export const writeReelConsent = () => storage.set(CONSENT_KEY, Date.now());
export const openReelSettings = () => ReelGuard?.openSettings();

/** Detection rules from Remote Config (JSON); empty keeps the built-in ones. */
export function applyReelRules(json: string) {
  try {
    ReelGuard?.setRules(json.trim() ? json : null);
  } catch (e) {
    reportError(e, 'reel rules');
  }
}

/** Whether counting is on, and the last `days` days of counts (today last). Updates live. */
export function useReelCounter(days = 1) {
  const [enabled, setEnabled] = useState(() => ReelGuard?.isEnabled() ?? false);
  const [stats, setStats] = useState<ReelDay[]>(() => ReelGuard?.getStats(days) ?? []);

  useEffect(() => {
    const guard = ReelGuard;
    if (!guard) return;
    const refresh = () => {
      setEnabled(guard.isEnabled());
      setStats(guard.getStats(days));
    };
    const sub = guard.addListener('onChange', refresh); // a reel was counted
    const app = AppState.addEventListener('change', (s) => s === 'active' && refresh()); // e.g. back from settings
    return () => {
      sub.remove();
      app.remove();
    };
  }, [days]);

  return { enabled, stats };
}

/** Totals for one day across the given apps. */
export function dayTotals(day: ReelDay | undefined, appIds: string[]) {
  let count = 0;
  let ms = 0;
  for (const id of appIds) {
    count += day?.apps[id]?.count ?? 0;
    ms += day?.apps[id]?.ms ?? 0;
  }
  return { count, ms };
}
