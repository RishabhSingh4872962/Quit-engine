import { HabitConfig } from './types';
import { reels } from './reels';
import { nicotine } from './nicotine';

export const HABITS: Record<string, HabitConfig> = { reels, nicotine };

/** Selected at build time: EXPO_PUBLIC_HABIT=nicotine npx expo start */
export const ACTIVE_HABIT: HabitConfig =
  HABITS[process.env.EXPO_PUBLIC_HABIT ?? 'reels'] ?? reels;
