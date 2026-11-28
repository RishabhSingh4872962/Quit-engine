import { useMemo } from 'react';
import { useMMKVString } from 'react-native-mmkv';
import { FocusTag, isFocusTag, isSubject, Subject, SUGGESTED_SUBJECTS } from '../rooms/data';
import { localDay } from './reels';
import { storage } from './storage';

/**
 * Focus timer state, on the phone only. One session at a time; it survives the app being closed
 * because only the start time is stored. Minutes focused are kept per day (60 days) for the
 * Focus tab and, later, the opt-in room leaderboard. State changes go through actions.ts.
 */

export type FocusMode = 'timer' | 'pomodoro' | 'stopwatch';

export interface FocusSession {
  startedAt: number; // epoch ms
  minutes: number; // timer: length; pomodoro: one focus round; stopwatch: the cap
  blockReels: boolean; // Premium: reels are blocked until the session ends
  mode?: FocusMode; // missing = timer (sessions saved by older versions)
  brk?: number; // pomodoro: break minutes
  rounds?: number; // pomodoro: focus rounds
  tag?: FocusTag; // what I'm focusing on (shown on my tile in rooms)
  earn?: number; // reels earned when it completes (started from the pause screen)
  subject?: Subject; // study time is logged per subject
  dnd?: boolean; // Do Not Disturb was turned on for this session
}

/** What the next session will be: a mode and its lengths. */
export interface FocusPlan {
  mode: FocusMode;
  minutes: number;
  brk?: number;
  rounds?: number;
}

export interface FocusPrefs {
  minutes: number; // timer length
  blockReels: boolean;
  mode: FocusMode;
  pomodoro: number; // index into POMODORO_PRESETS
  tag?: FocusTag;
  flip: boolean; // face down = black screen + soft ticks
  subject?: Subject; // for the next session
  subjects: Subject[]; // my subjects (empty = suggestions for the tag)
  goal: number; // daily focus goal in minutes, 0 = off
  dnd: boolean; // silence notifications while focusing (Android, needs DND access)
}

// Debug builds get 1-minute options for testing the end of a session or a round.
export const FOCUS_OPTIONS: readonly number[] = __DEV__ ? [1, 15, 25, 45, 60] : [15, 25, 45, 60];
export const POMODORO_PRESETS: readonly { focus: number; brk: number; rounds: number }[] = [
  { focus: 25, brk: 5, rounds: 4 },
  { focus: 50, brk: 10, rounds: 2 },
  { focus: 25, brk: 5, rounds: 2 },
  ...(__DEV__ ? [{ focus: 1, brk: 1, rounds: 2 }] : []),
];
/** A stopwatch stops by itself after this long (so blocking and alarms always have an end). */
export const STOPWATCH_CAP = 180;
export const GOAL_OPTIONS = [0, 60, 120, 240, 360, 480] as const;
const SESSION_KEY = 'focus.session';
const PREFS_KEY = 'focus.prefs';
const LOG_KEY = 'focus.log'; // { 'YYYY-MM-DD': minutes }
const SUBJECT_LOG_KEY = 'focus.subjectLog'; // { 'YYYY-MM-DD': { physics: minutes, … } }
const KEEP_DAYS = 60;

const parse = <T>(raw: string | undefined, fallback: T): T => {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const sessionMode = (s: FocusSession): FocusMode => s.mode ?? 'timer';

/** When the whole session ends (all pomodoro rounds; the cap for a stopwatch). */
export function focusEnd(s: FocusSession) {
  const mode = sessionMode(s);
  if (mode === 'pomodoro') {
    const rounds = s.rounds ?? 1;
    return s.startedAt + (rounds * s.minutes + (rounds - 1) * (s.brk ?? 0)) * 60_000;
  }
  return s.startedAt + (mode === 'stopwatch' ? STOPWATCH_CAP : s.minutes) * 60_000;
}

/** Whole minutes of focus between the start and `at` (pomodoro breaks don't count). */
export function focusedMinutes(s: FocusSession, at: number) {
  const t = Math.max(0, Math.min(at, focusEnd(s)) - s.startedAt) / 60_000;
  if (sessionMode(s) !== 'pomodoro') return Math.floor(t);
  const cycle = s.minutes + (s.brk ?? 0);
  const full = Math.floor(t / cycle);
  return Math.floor(full * s.minutes + Math.min(t - full * cycle, s.minutes));
}

export interface FocusPhase {
  phase: 'focus' | 'break';
  round: number; // 1-based
  rounds: number;
  left: number; // ms left in this phase
  total: number; // ms of this phase
}

/** Where a session is now: the current pomodoro round and phase (timer/stopwatch: one focus phase). */
export function focusPhase(s: FocusSession, now: number): FocusPhase {
  const elapsed = Math.max(0, now - s.startedAt);
  if (sessionMode(s) !== 'pomodoro') {
    const total = focusEnd(s) - s.startedAt;
    return { phase: 'focus', round: 1, rounds: 1, left: Math.max(0, total - elapsed), total };
  }
  const focusMs = s.minutes * 60_000;
  const cycle = focusMs + (s.brk ?? 0) * 60_000;
  const rounds = s.rounds ?? 1;
  const i = Math.min(rounds - 1, Math.floor(elapsed / cycle));
  const pos = elapsed - i * cycle;
  return pos < focusMs || i === rounds - 1
    ? { phase: 'focus', round: i + 1, rounds, left: Math.max(0, focusMs - pos), total: focusMs }
    : { phase: 'break', round: i + 1, rounds, left: cycle - pos, total: cycle - focusMs };
}

/** Pomodoro phase changes after `now`, for notifications: breaks starting and focus coming back. */
export function phaseChanges(s: FocusSession, now: number): { at: number; kind: 'break' | 'focus'; round: number; brk: number }[] {
  if (sessionMode(s) !== 'pomodoro') return [];
  const out: { at: number; kind: 'break' | 'focus'; round: number; brk: number }[] = [];
  const brk = s.brk ?? 0;
  for (let r = 1; r < (s.rounds ?? 1); r++) {
    const breakAt = s.startedAt + (r * s.minutes + (r - 1) * brk) * 60_000;
    out.push({ at: breakAt, kind: 'break', round: r, brk }, { at: breakAt + brk * 60_000, kind: 'focus', round: r + 1, brk });
  }
  return out.filter((c) => c.at > now);
}

/** The plan the Focus tab's current choices describe. */
export function planFromPrefs(p: FocusPrefs): FocusPlan {
  if (p.mode === 'pomodoro') {
    const preset = POMODORO_PRESETS[p.pomodoro] ?? POMODORO_PRESETS[0];
    return { mode: 'pomodoro', minutes: preset.focus, brk: preset.brk, rounds: preset.rounds };
  }
  return p.mode === 'stopwatch' ? { mode: 'stopwatch', minutes: STOPWATCH_CAP } : { mode: 'timer', minutes: p.minutes };
}

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
  earned?: number; // reels added to today's limit
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

const DEFAULT_PREFS: FocusPrefs = {
  minutes: 25, blockReels: false, mode: 'timer', pomodoro: 0, flip: false, subjects: [], goal: 0, dnd: false,
};
// Only offered values are valid (older versions could store a room round's length).
const cleanPrefs = (p: Partial<FocusPrefs>): FocusPrefs => {
  const m = { ...DEFAULT_PREFS, ...p };
  return {
    ...m,
    minutes: FOCUS_OPTIONS.includes(m.minutes) ? m.minutes : DEFAULT_PREFS.minutes,
    mode: ['timer', 'pomodoro', 'stopwatch'].includes(m.mode) ? m.mode : 'timer',
    pomodoro: POMODORO_PRESETS[m.pomodoro] ? m.pomodoro : 0,
    tag: isFocusTag(m.tag) ? m.tag : undefined,
    subject: isSubject(m.subject) ? m.subject : undefined,
    subjects: Array.isArray(m.subjects) ? m.subjects.filter(isSubject) : [],
    goal: (GOAL_OPTIONS as readonly number[]).includes(m.goal) ? m.goal : 0,
    dnd: m.dnd === true,
  };
};

/** The subjects offered on the Focus tab: mine, or suggestions for my exam tag. */
export const mySubjects = (p: FocusPrefs): Subject[] => (p.subjects.length ? p.subjects : SUGGESTED_SUBJECTS[p.tag ?? 'none']);
export const readFocusPrefs = () => cleanPrefs(parse<Partial<FocusPrefs>>(storage.getString(PREFS_KEY), {}));
export const writeFocusPrefs = (patch: Partial<FocusPrefs>) =>
  storage.set(PREFS_KEY, JSON.stringify({ ...readFocusPrefs(), ...patch }));

export function useFocusPrefs(): FocusPrefs {
  const [raw] = useMMKVString(PREFS_KEY, storage);
  return useMemo(() => cleanPrefs(parse<Partial<FocusPrefs>>(raw, {})), [raw]);
}

const readLog = () => parse<Record<string, number>>(storage.getString(LOG_KEY), {});

/** Adds focused minutes to a day (and its subject) and drops days older than KEEP_DAYS. */
export function addFocusMinutes(at: number, minutes: number, subject?: Subject) {
  if (minutes <= 0) return;
  const day = localDay(at);
  const oldest = localDay(at - KEEP_DAYS * 86_400_000);
  const log = readLog();
  log[day] = (log[day] ?? 0) + minutes;
  for (const d of Object.keys(log)) if (d < oldest) delete log[d];
  storage.set(LOG_KEY, JSON.stringify(log));
  if (!subject) return;
  const bySubject = parse<Record<string, Record<string, number>>>(storage.getString(SUBJECT_LOG_KEY), {});
  bySubject[day] = { ...bySubject[day], [subject]: (bySubject[day]?.[subject] ?? 0) + minutes };
  for (const d of Object.keys(bySubject)) if (d < oldest) delete bySubject[d];
  storage.set(SUBJECT_LOG_KEY, JSON.stringify(bySubject));
}

/** Minutes per day, and per subject per day (60 days), for the study screen. Updates live. */
export function useStudyLog() {
  const [raw] = useMMKVString(LOG_KEY, storage);
  const [rawSubjects] = useMMKVString(SUBJECT_LOG_KEY, storage);
  return useMemo(
    () => ({
      days: parse<Record<string, number>>(raw, {}),
      subjects: parse<Record<string, Partial<Record<Subject, number>>>>(rawSubjects, {}),
    }),
    [raw, rawSubjects],
  );
}

export const readTodayMinutes = (now = Date.now()) => readLog()[localDay(now)] ?? 0;

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
