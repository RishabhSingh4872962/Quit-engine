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
| Health apps declaration | Habit tracking that isn't medical. Pick the closest non-medical option; never "medical device" |
| Financial features, Government, News | None |
| Account deletion | `https://quit-engine-app.web.app/delete-account` |

## 5. Subscriptions (Premium)
1. Play Console → Monetize → Subscriptions: create `premium` with base plans `monthly` and `yearly` (INR prices).
2. RevenueCat: new project → Android app `com.quitengine.app` → Play service-account credentials → entitlement
   `premium` → offering with both packages.
3. `npx eas-cli env:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value <public SDK key> --environment production --environment preview`
4. Test with a license-tester account on the internal track. Builds without the key show no paywall; only debug builds use the test mode.

## 6. Testing and release
- Personal developer accounts: a **closed test with at least 12 testers for 14 days in a row** is required before
  production access.
- Before each release: `npx tsc --noEmit`, `npx eslint .`, a `preview` APK on a real phone. Check the reel counter,
  pause, blocking, widget, notifications and Google sign-in.
- Store listing: [store-listing.md](store-listing.md). Screenshots: light and dark, English and Hindi.
