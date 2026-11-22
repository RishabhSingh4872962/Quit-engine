import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Each habit ships as its own Play Store app, picked at build time with EXPO_PUBLIC_HABIT.
 * Keep this list in sync with src/habits/index.ts.
 * The package name is permanent once published.
 */
const HABITS = {
  reels: 'Reels Quitter',
  nicotine: 'Quit Nicotine',
} as const;

type HabitId = keyof typeof HABITS;
const isHabit = (id: string): id is HabitId => id in HABITS;

export default ({ config }: ConfigContext): ExpoConfig => {
  const id = process.env.EXPO_PUBLIC_HABIT ?? 'reels';
  if (!isHabit(id)) {
    throw new Error(`Unknown EXPO_PUBLIC_HABIT "${id}". Known habits: ${Object.keys(HABITS).join(', ')}`);
  }
  const appId = `com.quitengine.${id}`;

  return {
    ...config,
    name: HABITS[id],
    slug: `quit-engine-${id}`,
    android: { ...config.android, package: appId },
    ios: { ...config.ios, bundleIdentifier: appId },
  };
};
