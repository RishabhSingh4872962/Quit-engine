import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lang } from '../habits/types';

export interface State {
  quizAnswers: Record<string, number>;
  streakStart: number | null; // epoch ms
  relapses: number[]; // epoch ms
  urgesResisted: number;
  lang: Lang | null; // null = follow device language
}

export const EMPTY: State = { quizAnswers: {}, streakStart: null, relapses: [], urgesResisted: 0, lang: null };
const key = (habitId: string) => `quit-engine:${habitId}`;

export async function load(habitId: string): Promise<State> {
  const raw = await AsyncStorage.getItem(key(habitId));
  return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
}

export async function save(habitId: string, state: State): Promise<void> {
  await AsyncStorage.setItem(key(habitId), JSON.stringify(state));
}

export const streakDays = (s: State, now = Date.now()) =>
  s.streakStart ? Math.floor((now - s.streakStart) / 86_400_000) : 0;
