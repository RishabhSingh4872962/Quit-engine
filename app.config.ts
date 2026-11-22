import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Each habit ships as its own Play Store app, picked at build time with EXPO_PUBLIC_HABIT.
 * Keep this list in sync with src/habits/index.ts.
 * The package name is permanent once published.
 */
const HABITS = {
  reels: { name: 'Reels Quitter', accent: '#6C5CE7' },
  nicotine: { name: 'Quit Nicotine', accent: '#00B894' },
} as const;

type HabitId = keyof typeof HABITS;
const isHabit = (id: string): id is HabitId => id in HABITS;

export default ({ config }: ConfigContext): ExpoConfig => {
  const id = process.env.EXPO_PUBLIC_HABIT ?? 'reels';
  if (!isHabit(id)) {
    throw new Error(`Unknown EXPO_PUBLIC_HABIT "${id}". Known habits: ${Object.keys(HABITS).join(', ')}`);
  }
  const appId = `com.quitengine.${id}`;

  const habit = HABITS[id];

  return {
    ...config,
    name: habit.name,
    slug: `quit-engine-${id}`,
    android: { ...config.android, package: appId },
    ios: { ...config.ios, bundleIdentifier: appId },
    plugins: [
      ...(config.plugins ?? []),
      '@react-native-community/datetimepicker',
      [
        'expo-notifications',
        {
          icon: './assets/android-icon-monochrome.png', // small status-bar icon: white on transparent
          color: habit.accent,
          enableRemoteNotifications: false, // local notifications only for now
        },
      ],
    ],
  };
};
