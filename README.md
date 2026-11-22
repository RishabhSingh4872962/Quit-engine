# quit-engine

Config-driven habit-quitter app (Expo + TypeScript). One app, many habits: users pick one or more
(reels, nicotine, no-contact, nail-biting, skin-picking) and switch between them on Home.

## Run
Uses native modules (MMKV, Reanimated, Firebase), so it needs a development build, not Expo Go.

    npm install
    npx expo run:android            # build + install the dev app (com.quitengine.app)
    npx expo start --dev-client     # later: just start Metro

## Stack
React Navigation (static API) · Reanimated 4 + worklets · MMKV · i18next (en/hi) · light/dark theme
derived from the habit's accent colour · Baloo 2 font (Latin + Devanagari).

## Add a habit
Create `src/habits/<id>.ts` (see `reels.ts`), add the id to `HabitId` in `src/habits/types.ts`
and list it in `HABIT_LIST` in `src/habits/index.ts`. Each habit has its own accent colour,
icon, quiz, milestones and (optionally) urge-button text.

## Next
- Paywall after onboarding (RevenueCat)
- Reels mode: Android UsageStats screen-time tracking
