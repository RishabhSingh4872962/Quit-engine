import { useMemo } from 'react';
import { createMMKV, useMMKVObject, useMMKVString } from 'react-native-mmkv';
import { ACTIVE_HABIT } from '../habits';
import { Lang } from '../habits/types';

/** All app data lives on-device in MMKV (synchronous, so no loading states). */
export const storage = createMMKV({ id: 'quit-engine' });

// ---------- Habit progress ----------

export interface HabitState {
  quizAnswers: Record<string, number>;
  streakStart: number | null; // epoch ms
  relapses: number[]; // epoch ms
  urgesResisted: number;
  bestStreakDays: number; // longest finished streak; the current one is compared live
  celebrated: number; // highest milestone (days) already celebrated in the current streak
}

export const EMPTY: HabitState = {
  quizAnswers: {},
  streakStart: null,
  relapses: [],
  urgesResisted: 0,
  bestStreakDays: 0,
  celebrated: 0,
};

const STATE_KEY = `habit.${ACTIVE_HABIT.id}`;

export function readState(): HabitState {
  const raw = storage.getString(STATE_KEY);
  return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
}

export function writeState(patch: Partial<HabitState>) {
  storage.set(STATE_KEY, JSON.stringify({ ...readState(), ...patch }));
}

/** Re-renders whenever the habit state is written. */
export function useHabitState(): HabitState {
  const [value] = useMMKVObject<HabitState>(STATE_KEY, storage);
  return useMemo(() => ({ ...EMPTY, ...value }), [value]);
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
