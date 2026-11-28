import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useMMKVBoolean, useMMKVNumber } from 'react-native-mmkv';
import ReelGuard from '../../modules/reel-guard';
import type { ReelDay } from '../../modules/reel-guard';
import i18n from '../i18n';
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

// ---------- Daily limit ----------

const LIMIT_KEY = 'reels.limit'; // reels per day; 0 = no limit
export const LIMIT_OPTIONS = [0, 10, 20, 30, 50] as const;

export const readReelLimit = () => storage.getNumber(LIMIT_KEY) ?? 0;
export const writeReelLimit = (n: number) => storage.set(LIMIT_KEY, n);

export function useReelLimit(): number {
  const [v] = useMMKVNumber(LIMIT_KEY, storage);
  return v ?? 0;
}

// ---------- Live counter bubble ----------

const BUBBLE_KEY = 'reels.bubble';
export const readReelBubble = () => storage.getBoolean(BUBBLE_KEY) ?? false;
export const writeReelBubble = (on: boolean) => storage.set(BUBBLE_KEY, on);

export function useReelBubble(): boolean {
  const [v] = useMMKVBoolean(BUBBLE_KEY, storage);
  return v ?? false;
}

/** Sends the limit, bubble setting and their texts (in the app's language) to the native service. */
export function syncReelLimit() {
  try {
    ReelGuard?.setLimit(readReelLimit(), i18n.t('reels.nudge'));
    ReelGuard?.setBubble(readReelBubble(), i18n.t('reels.bubble'));
  } catch (e) {
    reportError(e, 'reel settings');
  }
}

export const reelLimitState = () => ReelGuard?.getLimitState();
/** "n more": the next pause comes n reels from now (or n after the current allowance, if later). */
export function allowMoreReelsToday(n: number, reelAppIds: string[]) {
  const state = ReelGuard?.getLimitState();
  if (!state || !state.limit) return;
  const total = dayTotals(readReelDays(1).at(-1), reelAppIds).count;
  const extra = Math.max(state.extraToday + n, total + n - state.limit);
  ReelGuard?.addExtraToday(extra - state.extraToday);
}
export const stopPausesToday = () => ReelGuard?.setPausesOffToday();
export const addReelExtraToday = (n: number) => ReelGuard?.addExtraToday(n);
export const resetReelPausesToday = () => ReelGuard?.resetToday();
export const openReelApp = (pkg: string) => ReelGuard?.openApp(pkg) ?? false;
export const readReelDays = (days: number): ReelDay[] => ReelGuard?.getStats(days) ?? [];
export const isReelCounterOn = () => ReelGuard?.isEnabled() ?? false;

/** Local calendar day as YYYY-MM-DD, matching the native store. */
export function localDay(time: number) {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Last millisecond of a YYYY-MM-DD day, local time. */
export function endOfDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
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
