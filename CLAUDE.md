# CLAUDE.md — quit-engine

## What this project is
A config-driven "habit quitter" mobile app (Expo + TypeScript, React Native). One app (`com.quitengine.app`) with many habits: users pick one or more during onboarding (and can add/remove later), then switch between them on Home. Each habit has its own streak, stats, milestones, colour and notifications.

Inspired by Quittr-style apps: a private, stigma-heavy habit people want to quit, a personalised onboarding quiz, a streak counter, an "I'm having an urge" button, milestones, and a paywall. The target audience is India first (English + Hindi, later more regional languages).

Habits: `reels` (Reels/Shorts), `nicotine` (cigarettes, gutka/tobacco, vape), `noContact` (breakups), `nailBiting`, `skinPicking`.

## About the developer
Rishabh, junior React Native developer in India, comfortable with Expo, TypeScript and Rust. Solo project. Prefers clear, small steps and explanations of why.

## Running
Needs a development build (native modules: MMKV, Reanimated, Firebase), not Expo Go:

    npx expo run:android          # build + install the dev app
    npx expo start --dev-client   # afterwards, just start Metro

`android/` and `ios/` are generated (CNG); configure native things in `app.json` / config plugins only.

## Architecture
- `src/habits/` — one config file per habit (`HabitConfig` in `types.ts`): short name, tagline, icon, accent colour, quiz, optional urge-button text, milestones, all text in `en` and `hi`. To add a habit: new config file, add its id to `HabitId`, list it in `HABIT_LIST` (`index.ts`).
- `src/lib/storage.ts` — all local data in MMKV: progress per habit (`habit.<id>`), tracked habits + selected habit, preferences. Hooks re-render on write.
- `src/lib/actions.ts` — every state change goes through here (streak start, slip, add/remove habit, settings), so side effects like rescheduling notifications live in one place.
- `src/lib/notifications.ts` — expo-notifications: milestone alerts per habit + one daily check-in; rebuilt from state after any relevant change. Copy is neutral (shows on the lock screen).
- `src/i18n/` — i18next with typed keys; `en.ts` is the source, `hi.ts` must match its shape. Shared UI text only; habit text stays in habit configs.
- `src/theme/` — calm & soft palette derived from the selected habit's accent; light/dark/system via `Appearance`. Baloo 2 font (Latin + Devanagari).
- `src/navigation/` — React Navigation 7 static API: onboarding until a habit is tracked, then tabs (Home, Milestones, Settings) plus modals (Urge, Celebrate, AddHabit).
- `src/screens/`, `src/components/` — UI; animations with Reanimated 4 (+ worklets).
- `src/widget/` — Android home-screen streak widget (react-native-android-widget). Shows days only, never the habit name. Refreshed from `actions.ts` and hourly.
- `src/lib/premium.ts` + `src/screens/Paywall.tsx` — soft paywall via RevenueCat (entitlement `premium`). Core app is free; Premium today = Reels screen time. Offered once, only when it has value for the user; always closable; no paywall/purchase analytics. Debug builds without `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (see `.env.example`) run a test mode with fake plans.
- `plugins/` — small local config plugins (e.g. Gradle heap), since `android/` is generated.
- `modules/reel-guard/` — local Expo module (Kotlin) with an Accessibility Service that counts reels/shorts and time inside the reels player, per app per day, on the phone only. Detection = view-ID rules (JSON; defaults in `ReelStore.kt`, override via Remote Config `reel_rules`). YouTube Shorts counts by page change, Instagram by pager scroll (`clips_viewer_view_pager`); both verified on a vivo V2312 (Android 15). Debug log: `adb shell run-as com.quitengine.app cat files/reel_guard_debug.log` (vivo hides app logcat). Instagram must be reopened once after the service is enabled. Force-stopping our app makes Android switch the service off (the app shows Off and the turn-on button). Needs the disclosure screen `ReelCounterSetup` before enabling (Play policy). Don't test with `uiautomator dump` while it runs: it disconnects the service.
- `modules/screen-time/` — local Expo module (Kotlin) reading Android usage stats. A habit opts in with `screenTime.apps` in its config (Reels does). Usage data never leaves the phone and must not go to analytics.

Rule: habit-specific content goes in the habit config, never hardcoded in screens. Adding a habit should mean adding one config file, not new screens.

## Roadmap (do one at a time)
Done: language picker, milestones + notifications, all habits in one app, Firebase (Crashlytics, Analytics, Remote Config, Google sign-in + Firestore backup), total days free after a slip, share card, home-screen widget, Reels screen time (Android), soft paywall (RevenueCat, test mode until keys exist).
Focus: Reels addiction (reference: Regain). Reels plan, in order:
- Phase 1 done: reel counter (Instagram Reels, YouTube Shorts), disclosure, "Reels today" card
- Phase 2 done: Instagram picture-in-picture time counts; daily limit (Settings) with nudges at 50%/80% (accessibility overlay), Pause screen at the limit (quitengine://pause; service presses Back and closes any reels PiP first), "5 more" / re-pause every 5 / "no more pauses today"; automatic streak slip when a day goes over the limit (counted from streak start or last limit change); widget shows "N today"
- Phase 3 done: "Your reels" history (7/30 days, per app, by hour, late night, time won back vs quiz), live counter bubble, weekly summary notification (quitengine://reels)
- Phase 3 open: more apps. Facebook strips view-ID names ("(name removed)"), so ID rules can't detect Reels; Snapchat obfuscates content IDs, only tab buttons are named (ngs_spotlight_icon_container) -> needs a selected-tab + swipe approach. Moj/Josh/ShareChat need a phone with those apps to calibrate. When calibrating, don't use uiautomator dump right after launching the target app (it stops that app's accessibility events until restart).
- Phase 4 done (Premium, src/lib/blocking.ts + ReelBlocking screen): block reels per app (Back + note; DMs/feed/search keep working), reel-free hours (bedtime, study), per-app daily limits, exam mode (until a date), strict mode (rules can't be loosened in the app while a reel-free time/exam runs; Android settings and uninstall always still work). Rules only sent to the service while Premium is active. YouTube "allowed channels" study mode dropped: it would mean reading channel names (content).
- Phase 5: focus timer, accountability partner/group, website blocking, more languages
Store/launch:
1. Set up RevenueCat + Play Console products (subscriptions `premium` monthly/yearly), add the key, test on a Play testing track
2. Play Store launch: EAS build/submit, Data Safety form, privacy policy, account deletion, app icon
3. Later: iOS Screen Time API for Reels
4. Separate later project: a motorcycle/bicycle/running ride app with a Rust core (`ride-core`: distance, pace, route simplification, crash detection) wrapped for React Native via UniFFI. Not part of this repo.

## Working rules
- Keep TypeScript strict; run `npx tsc --noEmit` and `npx eslint .` before saying a task is done.
- Make small commits, one feature per commit, with clear messages.
- Add dependencies only when needed; prefer Expo-compatible packages (`npx expo install <pkg>`). Check the SDK-versioned Expo docs before using an Expo/RN API.
- Navigation is React Navigation (chosen over Expo Router); state is MMKV + hooks. Don't add a state library unless complexity actually needs it.
- Never make medical or treatment claims in app copy (say "habit tracker", not "treatment"). Be gentle, non-shaming in all wording, especially around relapses.
- Privacy: habit data stays on the phone unless the user opts into cloud backup. Analytics events and notifications must not reveal which habit someone is quitting.
- Ask before big changes to the structure, and explain tradeoffs briefly.
