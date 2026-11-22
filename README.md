# quit-engine

Config-driven habit-quitter app (Expo + TypeScript). One codebase, many habits.

## Run
    npm install
    npx expo start                              # default habit: reels
    EXPO_PUBLIC_HABIT=nicotine npx expo start   # other habit

## Add a habit
Create `src/habits/<id>.ts` (see `reels.ts`), register it in `src/habits/index.ts`.

## Next
- Language picker (en/hi) and device-locale default
- Milestone screen + local notifications
- Paywall after onboarding (RevenueCat)
- Reels mode: Android UsageStats screen-time tracking
