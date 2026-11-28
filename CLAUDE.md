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
- `app.config.ts` + `eas.json` — EAS profiles (development / preview APK / production AAB, version codes managed by EAS). `google-services.json` is not in git; EAS gets it from the `GOOGLE_SERVICES_JSON` file env var.
- `hosting/` (Firebase Hosting: privacy policy, account deletion) + `docs/play-store/` (launch checklist, Data Safety, Accessibility declaration, store listing). When data handling, permissions or the accessibility service change, update these too.
- Screen-view analytics use an allow-list of habit-neutral screens (`src/lib/telemetry.ts`); new screens are not logged unless added there.
- Rooms (`src/lib/rooms.ts`, `src/screens/Rooms.tsx` tab, `Room`, `RoomProfile`, `CreateRoom`; lists in `src/rooms/data.ts`): Realtime Database `quit-engine-app-default-rtdb` (asia-southeast1). Kinds: study / silent / people (official, `scripts/rooms.json`) and custom (max 3 per person, public or invite-only by 6-char code). Anonymous Firebase sign-in for rooms; a Google account means backup is on (`useBackupUser`), and linking keeps the room nickname. Presence: `.info/connected` + onDisconnect sets `conn:false` (people mid-session stay listed until their session ends); phones go offline in the background (Spark plan: 100 connections). Shared timers count from midnight IST. Only nickname, avatar id, focus tag, focus status/minutes, finished-session posts, high fives and opt-in leaderboard minutes (total, and per subject in `sboard`) are shared: never a habit. Rules: `database.rules.json` (tests: `scripts/test-db-rules.mjs`, emulator needs Java 21+); moderation and admin: `docs/rooms-moderation.md`; room rules page `hosting/rules.html` (Play UGC policy).
- Calls (`src/lib/calls.ts`, `src/components/CallPanel.tsx`): voice + optional camera, only in invite-only rooms, only while the app is on screen. LiveKit Cloud for media; join tokens from a Cloudflare Worker (`workers/call-token`, secrets via `wrangler secret`) that checks the Firebase ID token (by reading the database with it), the `here/<room>/<uid>` marker and that the room is in `hidden/`. App needs `EXPO_PUBLIC_CALLS_URL`; without it the call card is hidden. `registerGlobals()` in `index.ts`.
- Focus tab (`src/screens/Focus.tsx`): modes Timer / Pomodoro (presets; `focusPhase`, phase alerts) / Stopwatch (3 h cap, ends 0 in room presence); optional focus tag (shown in rooms); Flip to focus (`FlipToFocus`: expo-sensors accelerometer + keep-awake while a session runs, black screen + soft tick; ACTIVITY_RECOGNITION blocked). Only `focusedMinutes` count (no breaks). Study: subjects are ids from `SUBJECTS` (`src/rooms/data.ts`, same list in the `sboard` rules), my subjects + daily goal in `FocusPrefs`, minutes per subject per day in `focus.subjectLog`; Study screen (7/30 days, by subject, goal). Focus timer (`src/lib/focus.ts`: session = start time + plan in MMKV, minutes per day kept 60 days; Premium "pause reels while focusing" = blocking `until` the session end), and media from `src/media/catalog.ts` (built-in rain/brown-noise loops from `scripts/make_sounds.py` + Remote Config `media_catalog` for lofi, guided audio, videos). One app-wide expo-audio player (`src/lib/sounds.ts`) with lock-screen controls (needed on Android, or background audio stops after ~3 min). JS timers don't run in the background: the OS notification marks the end (`delivery: 'alarmClock'`, exact only if the user allowed "Alarms & reminders": asked once at the first session), `actions.checkFocus()` closes the session on resume.
- `modules/reel-guard/` — local Expo module (Kotlin) with an Accessibility Service that counts reels/shorts and time inside the reels player, per app per day, on the phone only. Detection = view-ID rules (JSON; defaults in `ReelStore.kt`, override via Remote Config `reel_rules`). YouTube Shorts counts by page change, Instagram by pager scroll (`clips_viewer_view_pager`); both verified on a vivo V2312 (Android 15). Debug log: `adb shell run-as com.quitengine.app cat files/reel_guard_debug.log` (vivo hides app logcat). Instagram must be reopened once after the service is enabled. Force-stopping our app makes Android switch the service off (the app shows Off and the turn-on button). Needs the disclosure screen `ReelCounterSetup` before enabling (Play policy). Don't test with `uiautomator dump` while it runs: it disconnects the service.
- Pause before opening (`src/lib/gate.ts`, Settings → GateSettings; native `OpenGate.kt` + `ReelGuardService.appInFront`): apps from the Reels config `gateApps` (only installed ones shown; package ids also in the reel-guard manifest `<queries>`). The service also watches those packages, but only uses "came to the front" (topmost non-PiP app window) to count opens (`day|pkg|o`) and show a native full-screen breathing overlay; "Not now" = Home + skip count (`|s`), "Open" = grace (`grace|pkg`). Screen off resets the front app. Our own openApp sets a 2-min grace.
- Earned reels (`src/lib/earn.ts`): on the pause screen, a 10-min focus session (`FocusSession.earn`) earns 5 reels, a "Learn instead" round 3; max 15 a day. Earned reels raise that day's limit (native `addExtraToday` + `reels.earned` per day in MMKV, used by `checkReelLimit`), so unlike "5 more" they don't end the streak. No analytics.
- Journal (`src/lib/journal.ts`, screens `Journal` + `CheckIn`, Home `JournalCard`): per habit, phone only (not uploaded, not in backup, 90 days). Urge diary = trigger (shared ids + habit config `triggers`) and strength 1–5, saved by `actions.resistUrge` after the urge exercise. Daily promise (habit config `pledge`) during the day; evening check-in from 18:00 (mood, promise kept, private note; before 4 AM counts for the day before), also opened by the daily check-in notification (quitengine://checkin). Analytics only gets `pledge_made` / `checkin_done` without params.
- `modules/screen-time/` — local Expo module (Kotlin) reading Android usage stats. A habit opts in with `screenTime.apps` in its config (Reels does). Usage data never leaves the phone and must not go to analytics.

Rule: habit-specific content goes in the habit config, never hardcoded in screens. Adding a habit should mean adding one config file, not new screens.

## Roadmap (do one at a time)
Done: language picker, milestones + notifications, all habits in one app, Firebase (Crashlytics, Analytics, Remote Config, Google sign-in + Firestore backup), total days free after a slip, share card, home-screen widget, Reels screen time (Android), soft paywall (RevenueCat, test mode until keys exist).
Focus: Reels addiction (reference: Regain). Reels plan, in order:
- Phase 1 done: reel counter (Instagram Reels, YouTube Shorts), disclosure, "Reels today" card
- Phase 2 done: Instagram picture-in-picture time counts; daily limit (Settings) with nudges at 50%/80% (accessibility overlay), Pause screen at the limit (quitengine://pause; service presses Back and closes any reels PiP first), "5 more" / re-pause every 5 / "no more pauses today"; automatic streak slip when a day goes over the limit (counted from streak start or last limit change); widget shows "N today"
- Phase 3 done: "Your reels" history (7/30 days, per app, by hour, late night, time won back vs quiz), live counter bubble, weekly summary notification (quitengine://reels)
- Phase 3 open: more apps. Facebook strips view-ID names ("(name removed)"), so ID rules can't detect Reels; Snapchat obfuscates content IDs, only tab buttons are named (ngs_spotlight_icon_container) -> needs a selected-tab + swipe approach. Moj/Josh/ShareChat need a phone with those apps to calibrate. When calibrating, don't use uiautomator dump right after launching the target app (it stops that app's accessibility events until restart).
- Phase 4 done (Premium, src/lib/blocking.ts + ReelBlocking screen): block reels per app (Back + note; DMs/feed/search keep working), reel-free hours (bedtime, study), per-app daily limits, exam mode (until a date), strict mode (rules can't be loosened in the app while a reel-free time/exam runs; Android settings and uninstall always still work). Rules only sent to the service while Premium is active. YouTube study mode (Off / Study time / Always): only listed channels' videos play, Shorts blocked; reads the channel name from YouTube's "Subscribe to <channel>." label (English YouTube UI; other languages never block), with its own consent dialog. Matching ignores case, spaces and "@".
- Phase 5 (3–4 weeks from 22 Nov 2026, one week at a time):
  - Week 1, focus + media: focus timer; audio player (lofi, guided audio like urge surfing and a sleep wind-down) with background playback and lock-screen controls; short calm videos. Catalog from Remote Config/Firestore, files in Firebase Storage. Only royalty-free/licensed tracks.
  - Week 2, focus rooms (built; see Rooms above): Firebase anonymous auth (or the backup Google account) + nickname (never the Google name); room list, join, live presence (who's focusing, timer), preset cheers only (no free text, so little moderation).
  - Week 3, leaderboard: opt-in, per room, habit-neutral numbers only (focus minutes, days on track); nickname word filter + report; update privacy policy, Data Safety and the Play foreground-service (media playback) declaration.
  - Week 4: live calls in invite-only rooms (built: LiveKit + Cloudflare Worker; needs the user's LiveKit/Cloudflare accounts to go live), then polish + launch.
  - Rule for all of it: no server data may name or hint at the habit (room names, stats, presence, events).
  - Later: accountability partner, website blocking, more languages.
- Phase 6, all-in-one (competitor research 26 Nov 2026: one app instead of one sec, Opal, Forest, YPT, I Am Sober...), one at a time, in order:
  1. Pause before opening a chosen app (breathing gate, native overlay) + open counts (done)
  2. Urge diary (trigger/intensity/time, patterns) + daily pledge and evening check-in (done)
  3. Earn extra reels with a focus session + exam flashcards ("learn instead") on the pause screen (done)
  4. Study time by subject + daily goal + subject rank in rooms (done)
  5. Block reels/shorts in browsers (disclosure update)
  6. Accountability buddy (pair by code, opt-in summary, buddy approves extra time)
  7. Growing companion (rests, never dies) + plant together in rooms
  8. Money saved (nicotine)   9. Do Not Disturb during focus   10. Sturdier reel detection + self-check
  Skipped on purpose: AI coach, health timelines (medical claims), uninstall locks (Play), open chat.
Store/launch:
1. Set up RevenueCat + Play Console products (subscriptions `premium` monthly/yearly), add the key, test on a Play testing track
2. Play Store launch: prep done (icon + splash, eas.json, policy pages, form answers in docs/play-store). Open: fill contact placeholders + deploy hosting, Expo account + `eas init`, Play Console app, closed test (12 testers / 14 days), Firebase SHA-1s of the Play signing key
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
