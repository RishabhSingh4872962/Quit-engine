import { useMemo } from 'react';
import { useMMKVString } from 'react-native-mmkv';
import ReelGuard from '../../modules/reel-guard';
import i18n from '../i18n';
import { readPremium } from './premium';
import { storage } from './storage';
import { reportError } from './telemetry';

/**
 * Reel blocking (Premium, Android). The rules live here; the native service applies them when a
 * reels player opens (Back + a short note). DMs, feed and search in those apps keep working.
 */

export interface TimeWindow {
  on: boolean;
  start: number; // minutes from midnight
  end: number; // end < start means it runs past midnight
}

export interface BlockPrefs {
  apps: string[]; // reels always blocked in these apps
  appLimits: Record<string, number>; // per-app daily reel limit (0 = none)
  bedtime: TimeWindow;
  study: TimeWindow;
  examUntil: number; // block all reels until this time (epoch ms); 0 = off
  strict: boolean; // while a reel-free time or exam mode runs, rules can't be loosened in the app
}

export const DEFAULT_BLOCK: BlockPrefs = {
  apps: [],
  appLimits: {},
  bedtime: { on: false, start: 23 * 60, end: 7 * 60 },
  study: { on: false, start: 9 * 60, end: 13 * 60 },
  examUntil: 0,
  strict: false,
};

export const APP_LIMIT_OPTIONS = [0, 5, 10, 20, 30] as const;
const KEY = 'reels.block';

const parse = (raw: string | undefined): BlockPrefs => {
  try {
    return { ...DEFAULT_BLOCK, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_BLOCK;
  }
};

export const readBlock = () => parse(storage.getString(KEY));
export const writeBlock = (patch: Partial<BlockPrefs>) => storage.set(KEY, JSON.stringify({ ...readBlock(), ...patch }));

export function useBlock(): BlockPrefs {
  const [raw] = useMMKVString(KEY, storage);
  return useMemo(() => parse(raw), [raw]);
}

const inWindow = (w: TimeWindow, minute: number) =>
  w.on && w.start !== w.end && (w.start < w.end ? minute >= w.start && minute < w.end : minute >= w.start || minute < w.end);

/** When the reel-free time or exam mode running now ends (epoch ms), or null if none is running. */
export function activeBlockUntil(prefs: BlockPrefs, now = Date.now()): number | null {
  const d = new Date(now);
  const minute = d.getHours() * 60 + d.getMinutes();
  const ends: number[] = [];
  if (prefs.examUntil > now) ends.push(prefs.examUntil);
  for (const w of [prefs.bedtime, prefs.study]) {
    if (!inWindow(w, minute)) continue;
    const end = new Date(now);
    end.setHours(Math.floor(w.end / 60), w.end % 60, 0, 0);
    if (end.getTime() <= now) end.setDate(end.getDate() + 1); // overnight window ends tomorrow
    ends.push(end.getTime());
  }
  return ends.length ? Math.max(...ends) : null;
}

/** Strict mode is holding the rules right now. */
export const strictLocked = (prefs: BlockPrefs, now = Date.now()) => prefs.strict && activeBlockUntil(prefs, now) !== null;

/** Sends the rules to the native service (only with Premium; otherwise blocking is off). */
export function syncReelBlock() {
  try {
    const p = readBlock();
    const windows = [p.bedtime, p.study].filter((w) => w.on && w.start !== w.end).map((w) => [w.start, w.end]);
    const anything = p.apps.length || Object.values(p.appLimits).some((n) => n > 0) || windows.length || p.examUntil > Date.now();
    ReelGuard?.setBlock(
      readPremium() && anything
        ? JSON.stringify({ apps: p.apps, appLimits: p.appLimits, windows, until: p.examUntil, text: i18n.t('blocking.note') })
        : null,
    );
  } catch (e) {
    reportError(e, 'reel block');
  }
}
