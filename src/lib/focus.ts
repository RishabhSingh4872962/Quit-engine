import { useMemo } from 'react';
import { useMMKVString } from 'react-native-mmkv';
import { localDay } from './reels';
import { storage } from './storage';

/**
 * Focus timer state, on the phone only. One session at a time; it survives the app being closed
 * because only the start time is stored. Minutes focused are kept per day (60 days) for the
 * Focus tab and, later, the opt-in room leaderboard. State changes go through actions.ts.
 */

export interface FocusSession {
  startedAt: number; // epoch ms
  minutes: number;
  blockReels: boolean; // Premium: reels are blocked until the session ends
}

export interface FocusPrefs {
  minutes: number;
  blockReels: boolean;
}

// Debug builds get a 1-minute session for testing the end of a session.
export const FOCUS_OPTIONS: readonly number[] = __DEV__ ? [1, 15, 25, 45, 60] : [15, 25, 45, 60];
const SESSION_KEY = 'focus.session';
const PREFS_KEY = 'focus.prefs';
const LOG_KEY = 'focus.log'; // { 'YYYY-MM-DD': minutes }
const KEEP_DAYS = 60;

const parse = <T>(raw: string | undefined, fallback: T): T => {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const focusEnd = (s: FocusSession) => s.startedAt + s.minutes * 60_000;

export const readSession = () => parse<FocusSession | null>(storage.getString(SESSION_KEY), null);
export const writeSession = (s: FocusSession | null) =>
  s ? storage.set(SESSION_KEY, JSON.stringify(s)) : storage.remove(SESSION_KEY);

export function useFocusSession(): FocusSession | null {
  const [raw] = useMMKVString(SESSION_KEY, storage);
  return useMemo(() => parse<FocusSession | null>(raw, null), [raw]);
}

/** The session that just ended, shown on the Focus tab until dismissed or a new one starts. */
export interface FocusDone {
  minutes: number;
  complete: boolean; // false = ended early
}

const DONE_KEY = 'focus.done';
export const writeFocusDone = (d: FocusDone | null) =>
  d ? storage.set(DONE_KEY, JSON.stringify(d)) : storage.remove(DONE_KEY);

export function useFocusDone(): FocusDone | null {
  const [raw] = useMMKVString(DONE_KEY, storage);
  return useMemo(() => parse<FocusDone | null>(raw, null), [raw]);
}

const EXACT_ASKED_KEY = 'focus.exactAsked';
export const readExactAsked = () => storage.getBoolean(EXACT_ASKED_KEY) ?? false;
export const writeExactAsked = () => storage.set(EXACT_ASKED_KEY, true);

const DEFAULT_PREFS: FocusPrefs = { minutes: 25, blockReels: false };
export const readFocusPrefs = () => ({ ...DEFAULT_PREFS, ...parse<Partial<FocusPrefs>>(storage.getString(PREFS_KEY), {}) });
export const writeFocusPrefs = (patch: Partial<FocusPrefs>) =>
  storage.set(PREFS_KEY, JSON.stringify({ ...readFocusPrefs(), ...patch }));

export function useFocusPrefs(): FocusPrefs {
  const [raw] = useMMKVString(PREFS_KEY, storage);
  return useMemo(() => ({ ...DEFAULT_PREFS, ...parse<Partial<FocusPrefs>>(raw, {}) }), [raw]);
}

const readLog = () => parse<Record<string, number>>(storage.getString(LOG_KEY), {});

/** Adds focused minutes to a day and drops days older than KEEP_DAYS. */
export function addFocusMinutes(at: number, minutes: number) {
  if (minutes <= 0) return;
  const log = readLog();
  const day = localDay(at);
  log[day] = (log[day] ?? 0) + minutes;
  const oldest = localDay(at - KEEP_DAYS * 86_400_000);
  for (const d of Object.keys(log)) if (d < oldest) delete log[d];
  storage.set(LOG_KEY, JSON.stringify(log));
}

/** Minutes focused today and in the last 7 days (today included). */
export function useFocusTotals(now: number): { today: number; week: number } {
  const [raw] = useMMKVString(LOG_KEY, storage);
  return useMemo(() => {
    const log = parse<Record<string, number>>(raw, {});
    let week = 0;
    for (let i = 0; i < 7; i++) week += log[localDay(now - i * 86_400_000)] ?? 0;
    return { today: log[localDay(now)] ?? 0, week };
  }, [raw, now]);
}
