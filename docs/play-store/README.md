# Play Store launch checklist

Files in this folder:
- [data-safety.md](data-safety.md): Data Safety form answers
- [accessibility-declaration.md](accessibility-declaration.md): Accessibility API declaration and demo-video script
- [store-listing.md](store-listing.md): name, descriptions (English and Hindi), graphics list

The web pages are in [`hosting/`](../../hosting) (privacy policy and account deletion, served by Firebase Hosting).

## 1. Web pages
1. Replace `[DEVELOPER NAME]` and `[CONTACT EMAIL]` in `hosting/privacy.html` and `hosting/delete-account.html`.
   Use a support address, not a personal one: the pages are public.
2. `npx -y firebase-tools@latest deploy --only hosting --project quit-engine-app`
3. Check https://quit-engine-app.web.app/privacy and `/delete-account`. The app links to `/privacy` from Settings.

## 2. EAS (Expo account)
1. `npx eas-cli@latest login`, then `npx eas-cli@latest init` (this writes `extra.eas.projectId` to `app.json`; commit it).
2. Upload `google-services.json` as a secret file (it's not in git):
   `npx eas-cli env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production --environment preview`
3. Version codes are managed by EAS (`appVersionSource: remote`, `autoIncrement` on production). Change only
   `expo.version` in `app.json` for user-visible versions.

Profiles in [`eas.json`](../../eas.json): `development` (dev client APK), `preview` (release APK for testers),
`production` (AAB for Play).

## 3. Play Console
1. Create the app: name "Quit Engine", default language English (India), App, Free.
2. Build: `npx eas-cli build -p android --profile production`. Let EAS create the upload key and keep Play App Signing on.
3. The **first** AAB must be uploaded by hand (Testing → Internal testing → Create release). After that, use
   `eas submit -p android --profile production` with a Play service-account key.
4. **Firebase SHA-1s:** add the SHA-1 of the *app signing key* (Play Console → Setup → App signing) and of the EAS
   upload key (`eas credentials`) to the Firebase Android app. Without them, Google sign-in fails in store builds.

## 4. App content (Play Console → Policy → App content)
| Section | Answer |
|---|---|
| Privacy policy | `https://quit-engine-app.web.app/privacy` |
| Ads | No ads |
| App access | All features available without special access. Add a note that Premium features are shown in the accessibility demo video |
| Target audience | 13 and over (not designed for children) |
| Content rating | Questionnaire: utility/productivity; answer *yes* to "references to tobacco" (quitting cigarettes/gutka) and *no* to everything else |
| Data safety | [data-safety.md](data-safety.md) |
| Sensitive permissions → Accessibility API | [accessibility-declaration.md](accessibility-declaration.md), plus the unlisted YouTube video |
| Exact alarms | Nothing to declare: the app uses `SCHEDULE_EXACT_ALARM` (the user allows it in Android settings), not the restricted `USE_EXACT_ALARM`. Used only so the "focus session complete" alert rings on time |
| Foreground service permissions → Media playback | "Focus sounds, music and guided audio that the user starts keep playing with the screen off; the media notification lets them pause or stop it." Add a short video: Focus tab → play Rain → lock the phone → media notification → pause |
| Health apps declaration | Habit tracking that isn't medical. Pick the closest non-medical option; never "medical device" |
| Content rating: user interaction | Yes: users interact in rooms (nicknames, high fives, no chat or media). Rooms rules: `https://quit-engine-app.web.app/rules`; reporting and hiding are in the app; moderation steps in [../rooms-moderation.md](../rooms-moderation.md) |
| Financial features, Government, News | None |
| Account deletion | `https://quit-engine-app.web.app/delete-account` |

## 5. Subscriptions (Premium)
1. Play Console → Monetize → Subscriptions: create `premium` with base plans `monthly` and `yearly` (INR prices).
2. RevenueCat: new project → Android app `com.quitengine.app` → Play service-account credentials → entitlement
   `premium` → offering with both packages.
3. `npx eas-cli env:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value <public SDK key> --environment production --environment preview`
4. Test with a license-tester account on the internal track. Builds without the key show no paywall; only debug builds use the test mode.

## 6. Calls in invite-only rooms (LiveKit + Cloudflare)
1. LiveKit Cloud (free): create a project; note its URL (`wss://….livekit.cloud`), API key and API secret.
2. Put the URL in `workers/call-token/wrangler.toml` (`LIVEKIT_URL`), then:
   ```sh
   cd workers/call-token
   npx wrangler login
   npx wrangler secret put LIVEKIT_API_KEY      # paste the key
   npx wrangler secret put LIVEKIT_API_SECRET   # paste the secret (never in git)
   npx wrangler deploy                          # prints https://quit-engine-calls.<you>.workers.dev
   ```
3. Set `EXPO_PUBLIC_CALLS_URL` to that Worker URL (`.env` locally, EAS env for builds). Without it the call
   card is hidden.
4. Play Console: microphone and camera are normal runtime permissions (no declaration); Data Safety rows are in
   [data-safety.md](data-safety.md).

## 6b. Focus sounds, music and videos
Extra content is listed in the Remote Config parameter `media_catalog` (JSON array; format in
`src/media/catalog.ts`), with files in Firebase Storage or any https host. Only use files you're allowed to
use in an app: your own, CC0, or a licence that allows in-app streaming (many "free" music sites forbid
offering their tracks as standalone music). Put the credit in `by`. Example:

```json
[
  { "id": "lofi-1", "kind": "music", "title": { "en": "Late night lofi", "hi": "देर रात लो-फ़ाई" }, "by": "Artist name", "url": "https://firebasestorage.googleapis.com/…" },
  { "id": "urge-surf", "kind": "guided", "title": { "en": "Ride the urge", "hi": "तलब की लहर" }, "minutes": 5, "url": "https://…/urge-surf.m4a" },
  { "id": "calm-sea", "kind": "video", "title": { "en": "Calm sea" }, "minutes": 3, "url": "https://…/calm-sea.mp4" }
]
```

## 7. Testing and release
- Personal developer accounts: a **closed test with at least 12 testers for 14 days in a row** is required before
  production access.
- Before each release: `npx tsc --noEmit`, `npx eslint .`, a `preview` APK on a real phone. Check the reel counter,
  pause, blocking, widget, notifications and Google sign-in.
- Store listing: [store-listing.md](store-listing.md). Screenshots: light and dark, English and Hindi.
