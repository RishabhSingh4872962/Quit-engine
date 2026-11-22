import { useMemo } from 'react';
import { createMMKV, useMMKVBoolean, useMMKVObject, useMMKVString } from 'react-native-mmkv';
import { HABIT_LIST, HABITS, isHabitId } from '../habits';
import { HabitConfig, HabitId, Lang } from '../habits/types';

/** All app data lives on-device in MMKV (synchronous, so no loading states). */
export const storage = createMMKV({ id: 'quit-engine' });

// ---------- Progress, one record per habit ----------

export interface HabitState {
  quizAnswers: Record<string, number>;
  streakStart: number | null; // epoch ms
  relapses: number[]; // epoch ms
  urgesResisted: number;
  bestStreakDays: number; // longest finished streak; the current one is compared live
  pastDaysFree: number; // whole days from earlier streaks; a slip adds to this, never resets it
  celebrated: number; // highest milestone (days) already celebrated in the current streak
}

export const EMPTY: HabitState = {
  quizAnswers: {},
  streakStart: null,
  relapses: [],
  urgesResisted: 0,
  bestStreakDays: 0,
  pastDaysFree: 0,
  celebrated: 0,
};

const stateKey = (id: HabitId) => `habit.${id}`;

export function readState(id: HabitId): HabitState {
  const raw = storage.getString(stateKey(id));
  return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
}

export function writeState(id: HabitId, patch: Partial<HabitState>) {
  storage.set(stateKey(id), JSON.stringify({ ...readState(id), ...patch }));
}

/** Re-renders whenever this habit's state is written. */
export function useHabitState(id: HabitId): HabitState {
  const [value] = useMMKVObject<HabitState>(stateKey(id), storage);
  return useMemo(() => ({ ...EMPTY, ...value }), [value]);
}

// ---------- Which habits the user tracks, and which one is on screen ----------

const TRACKED_KEY = 'prefs.habits';
const ACTIVE_KEY = 'prefs.activeHabit';

const parseTracked = (raw: string | undefined): HabitId[] => {
  try {
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(isHabitId) : [];
  } catch {
    return [];
  }
};

const pickActive = (value: string | undefined, tracked: HabitId[]) =>
  isHabitId(value) && tracked.includes(value) ? value : tracked[0];

export const readTracked = () => parseTracked(storage.getString(TRACKED_KEY));
export const writeTracked = (ids: HabitId[]) => storage.set(TRACKED_KEY, JSON.stringify(ids));
export const readActive = (): HabitId | undefined => pickActive(storage.getString(ACTIVE_KEY), readTracked());
export const writeActive = (id: HabitId) => storage.set(ACTIVE_KEY, id);

/** Tracked habits in the order the user added them. */
export function useTracked(): HabitId[] {
  const [raw] = useMMKVString(TRACKED_KEY, storage);
  return useMemo(() => parseTracked(raw), [raw]);
}

/** Selected habit id, or undefined before onboarding. */
export function useActiveHabitId(): HabitId | undefined {
  const [value] = useMMKVString(ACTIVE_KEY, storage);
  const tracked = useTracked();
  return pickActive(value, tracked);
}

/** Selected habit's config. Screens after onboarding always have one; the fallback only guards types. */
export function useActiveHabit(): HabitConfig {
  const id = useActiveHabitId();
  return id ? HABITS[id] : HABIT_LIST[0];
}

// ---------- Preferences ----------

export type ThemePref = 'system' | 'light' | 'dark';

export const LANG_KEY = 'prefs.lang';
export const THEME_KEY = 'prefs.theme';

export const readLangPref = (): Lang | undefined => {
  const v = storage.getString(LANG_KEY);
  return v === 'en' || v === 'hi' ? v : undefined;
};

const toThemePref = (v: string | undefined): ThemePref => (v === 'light' || v === 'dark' ? v : 'system');

export const readThemePref = () => toThemePref(storage.getString(THEME_KEY));

export function useThemePref(): ThemePref {
  const [v] = useMMKVString(THEME_KEY, storage);
  return toThemePref(v);
}

// ---------- Notification preferences ----------

export interface CheckinPref {
  enabled: boolean;
  hour: number; // 0–23, local time
  minute: number;
}

export const DEFAULT_CHECKIN: CheckinPref = { enabled: true, hour: 21, minute: 0 };

const CHECKIN_KEY = 'prefs.checkin';
const MILESTONE_ALERTS_KEY = 'prefs.milestoneAlerts';

export function readCheckin(): CheckinPref {
  const raw = storage.getString(CHECKIN_KEY);
  return raw ? { ...DEFAULT_CHECKIN, ...JSON.parse(raw) } : DEFAULT_CHECKIN;
}

export function writeCheckin(patch: Partial<CheckinPref>) {
  storage.set(CHECKIN_KEY, JSON.stringify({ ...readCheckin(), ...patch }));
}

export function useCheckin(): CheckinPref {
  const [v] = useMMKVObject<CheckinPref>(CHECKIN_KEY, storage);
  return useMemo(() => ({ ...DEFAULT_CHECKIN, ...v }), [v]);
}

export const readMilestoneAlerts = () => storage.getBoolean(MILESTONE_ALERTS_KEY) ?? true;
export const writeMilestoneAlerts = (on: boolean) => storage.set(MILESTONE_ALERTS_KEY, on);

export function useMilestoneAlerts(): boolean {
  const [v] = useMMKVBoolean(MILESTONE_ALERTS_KEY, storage);
  return v ?? true;
}
