# Data Safety form – answers

Play Console → App content → Data safety. Based on the code as of 22 Nov 2026 and on the published guidance from
[Firebase](https://firebase.google.com/docs/android/play-data-disclosure) and
[RevenueCat](https://www.revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety).
Update this file when the app starts sending anything new.

"Collected" in Play's sense means *sent off the phone*. Data the app only processes on the phone (reel counts,
accessibility events, usage stats, blocking rules, the journal) is not declared here. It is explained in the privacy policy and
the Accessibility declaration.

## Overview questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (Firebase, RevenueCat and Google Play all use HTTPS) |
| Which account creation methods does your app support? | **OAuth: Sign in with Google** (optional, only for cloud backup) |
| Delete account URL | `https://quit-engine-app.web.app/delete-account` |
| Do you provide a way for users to request that some or all of their data is deleted, without deleting their account? | **Yes**: by email (see the privacy policy) |
| Has your app been independently validated against a global security standard? | No |

## Data types

Firebase and RevenueCat are service providers acting for us, so nothing below counts as **shared**.

| Category → type | Collected | Optional? | Ephemeral? | Purposes | Source |
|---|---|---|---|---|---|
| Personal info → **Name** | Yes | Optional | No | Account management, App functionality | Google sign-in for backup (Firebase Auth display name) |
| Personal info → **Email address** | Yes | Optional | No | Account management, App functionality | Google sign-in for backup (Firebase Auth) |
| Personal info → **User IDs** | Yes | Optional | No | Account management, App functionality | Firebase Auth user ID: Google account for backup, a random anonymous id for rooms |
| Health and fitness → **Health info** | Yes | Optional | No | App functionality | Cloud backup: which habits are tracked (nicotine, nail biting, skin picking…), quiz answers, streak numbers |
| Financial info → **Purchase history** | Yes | Optional (only if the user buys) | No | App functionality, Analytics | RevenueCat (subscription status, renewals, refunds) |
| App activity → **App interactions** | Yes | Required | No | Analytics, App functionality | Google Analytics for Firebase: habit-neutral events and shared screen views (see `src/lib/telemetry.ts`); in rooms (optional): focus status, focus minutes (on leaderboards also per study subject, from a fixed list), finished-session posts, high fives; with an accountability buddy (optional): days on track, focus minutes today, whether today's check-in kept the promise, and "5 more" requests and answers |
| Audio → **Voice or sound recordings** | Yes | Optional | **Yes** (processed ephemerally) | App functionality | Voice calls in invite-only rooms, streamed live through LiveKit; never recorded or stored |
| Photos and videos → **Videos** | Yes | Optional | **Yes** (processed ephemerally) | App functionality | Optional camera in those calls, streamed live; never recorded or stored |
| App activity → **Other user-generated content** | Yes | Optional | No | App functionality | Rooms: nicknames and names of rooms people create (shown to other users in rooms); buddy: the display name shown to the paired buddy |
| App info and performance → **Crash logs** | Yes | Required | No | App functionality, Analytics | Firebase Crashlytics (release builds) |
| App info and performance → **Diagnostics** | Yes | Required | No | App functionality, Analytics | Crashlytics device metadata and app state; Analytics device info |
| Device or other IDs → **Device or other IDs** | Yes | Required | No | App functionality, Analytics | Firebase installation ID, Analytics app-instance ID, Crashlytics installation UUID, RevenueCat anonymous ID; with an accountability buddy (optional): the phone's push token (FCM), so the buddy's requests and answers can notify it |

Not collected: location (no location permission; Firebase only derives a rough country from the connection),
photos and videos, audio, files, contacts, calendar, messages, web browsing, installed apps list, advertising ID
(the `AD_ID` permission is removed and `google_analytics_adid_collection_enabled` is `false`).

### Calls
LiveKit (media) and Cloudflare (the token Worker) are service providers. Calls only exist in invite-only rooms,
only while the app is on screen; microphone and camera are asked for when first used.

### Buddy notifications
While someone is paired with a buddy, their phone's FCM push token sits at `push/<uid>` in the Realtime Database,
readable only by that buddy, and is deleted when the pairing ends. Cloudflare (the push Worker) and Google
(Firebase Cloud Messaging) are service providers. The notification text never names a habit: "<name> asks for
5 more today" / "Your buddy answered". Nothing else is sent.

### Rooms and "shared"
What people show in rooms (nickname, focus minutes) is seen by other users because they chose to join.
Play doesn't count user-initiated transfers like this as "sharing", so it stays under "Collected" only.
Rooms data is stored in the Realtime Database in Singapore (asia-southeast1).

### Why "Health info"
The backup contains which habit someone is quitting, which can be health-related (nicotine, skin picking).
Declaring it costs nothing. Leaving it out would be an under-declaration, which Play treats as a policy violation.
If you'd rather avoid the label, the alternative is to stop backing up the habit ids, which would make backups
useless. So keep it.

### Why "Required" for analytics and crash logs
The app has no switch to turn Analytics or Crashlytics off. If you add one in Settings later, change these rows
to "Optional".

## Things to keep true (or update this form)

- No analytics event, user property or screen view may name a habit. Reel screens, Pause and Paywall are kept out
  by the allow-list in `src/lib/telemetry.ts`. Keep it an allow-list.
- No reel counts, screen time, blocking rules or YouTube channel names may leave the phone.
- The journal (urge triggers and strength, promises, moods, notes) never leaves the phone and is not in the backup.
- "Count in browsers" reads web addresses on the phone only; never log, store or send them (it would be Web browsing history).
  Analytics only gets `pledge_made` / `checkin_done` with no parameters.
- Don't add RevenueCat customer attributes (email, name) or ad-ID integrations. Either one would add Personal info or
  Device ID rows for RevenueCat.
- Check the data-retention setting in Google Analytics (Admin → Data collection → Data retention). The privacy policy
  says 2 months, which is the default.
