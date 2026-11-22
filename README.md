# quit-engine

Config-driven habit-quitter app (Expo + TypeScript). One codebase, many habits.

## Run
Uses native modules (MMKV, Reanimated, Firebase), so it needs a development build, not Expo Go.

    npm install
    npx expo run:android                                # build + install the dev app (default habit: reels)
    npx expo start --dev-client                         # later: just start Metro
    EXPO_PUBLIC_HABIT=nicotine npx expo prebuild --clean && EXPO_PUBLIC_HABIT=nicotine npx expo run:android

Each habit is its own app (`com.quitengine.<habit>`, see `app.config.ts`), so switching habits
needs a clean prebuild.

## Stack
React Navigation (static API) · Reanimated 4 + worklets · MMKV · i18next (en/hi) · light/dark theme
derived from the habit's accent colour · Baloo 2 font (Latin + Devanagari).

## Add a habit
Create `src/habits/<id>.ts` (see `reels.ts`), register it in `src/habits/index.ts` and add its
store name to `app.config.ts`.

## Next
- Milestone screen + local notifications
- Paywall after onboarding (RevenueCat)
- Reels mode: Android UsageStats screen-time tracking
