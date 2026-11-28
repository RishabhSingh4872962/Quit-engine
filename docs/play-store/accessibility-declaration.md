# Accessibility API declaration – answers and demo video

Play Console → App content → Sensitive app permissions → **Accessibility API**.
The service is `expo.modules.reelguard.ReelGuardService` (`modules/reel-guard`), declared with
`android:isAccessibilityTool="false"`. Play policy: an app that is not an accessibility tool may use the API for
features described to the user, with a prominent in-app disclosure, affirmative consent, and this declaration.

## Form answers

**Is your app an accessibility tool?** No.

**Which features use the Accessibility API?** Paste:

> Quit Engine helps people cut down on short-video scrolling. With the user's consent, its accessibility service
> runs in Instagram and YouTube (and, only if the user turns on "Count in browsers", in web browsers) and uses view IDs (for example `clips_viewer_view_pager`,
> `reel_player_page_container`) to detect when the Reels or Shorts player is open and when the user swipes to the
> next reel. It uses this to:
> 1. Count reels/Shorts watched and time spent in the reels player per day, shown to the user in the app.
> 2. Show short on-screen notes at 50% and 80% of the daily limit the user set, and an optional counter bubble.
> 3. When the user's own daily limit is reached, or a block the user set is active (Premium: block reels in an app,
>    reel-free hours, exam mode, per-app limits), press Back to leave the reels player, close the reels
>    picture-in-picture window, and open the app's pause screen. Messages, feed and search keep working.
> 4. Optional YouTube study mode: read the channel name of the opened video (from the "Subscribe to …" label) to
>    compare it with the user's list of allowed channels, and pause and leave videos from other channels.
>    This has its own consent dialog.
>
> 5. Optional "Pause before opening": for apps the user picks (e.g. Instagram, YouTube, games), it notices only
>    that the app came to the front, counts the open on the phone, and shows a short full-screen breathing pause
>    with "Not now" (goes to the home screen) and "Open" (continues; no pause again for a grace period the user
>    sets). Nothing inside those apps is read.
> 6. Optional "Count in browsers" (its own consent dialog, off by default): in browsers (Chrome, Samsung Internet,
>    Firefox, Edge, Brave, Opera, DuckDuckGo), it reads only the text of the address bar (view ID `url_bar` and
>    equivalents) while the browser is on screen, to notice YouTube Shorts and Instagram Reels pages
>    (`youtube.com/shorts/…`, `instagram.com/reels/…`). Those count like reels in the apps, and the same limit,
>    pause and blocking rules apply (Back leaves the page). The address is compared on the phone and never
>    stored or sent; page content, history and typed text are not read.
>
> Every action is a fixed rule the user set up ("if the reel count reaches your limit, then pause"). The service
> does not read messages, comments, captions, passwords or text input, does not act in other apps, and does not
> send anything off the device. All counts are stored only on the phone. Users can turn it off at any time in
> Android Accessibility settings. Uninstalling always works.

**Does your app collect or share data using the Accessibility API?** No personal or sensitive data leaves the device.
The service stores only per-day reel counts and time (60 days, on device).

**Prominent disclosure:** the `ReelCounterSetup` screen (Home → "Reels today" → "Turn on reel counting"), shown before the user is
sent to Android settings. It lists what is read, what is never read, and where data is stored, with "I agree, turn it on" and
"Not now" buttons. YouTube study mode shows a second consent dialog before it turns on.

**Video link:** an unlisted YouTube link (see the script below).

## Demo video script (about 2 minutes, screen recording, English UI)

Record on a real phone with `adb shell screenrecord`, or with the phone's own screen recorder. Use a fresh install of the
production build (`eas build --profile preview` APK), not the dev build. Keep the status bar visible.

1. **Disclosure** (0:00–0:20). Open the app → Home → "Reels today" card → "Turn on reel counting". Scroll slowly through the
   disclosure screen (what is read / never read / stored on this phone). Tap **I agree, turn it on**.
2. **Enabling** (0:20–0:40). The app opens Android Accessibility settings → Quit Engine → turn on → accept the
   system dialog. Return to the app; the card shows it's on.
3. **Counting** (0:40–1:00). Settings → reel limit 10. Open Instagram → Reels and swipe a few reels; the counter
   bubble goes up. Do the same in YouTube Shorts.
4. **Nudge and pause** (1:00–1:25). Keep swiping: the "5 of 10" note appears, then at 10 the app presses Back and
   shows the pause screen. Tap "I'm done for today".
5. **Blocking, Premium** (1:25–1:45). Settings → Reel blocking → block reels in YouTube → open Shorts: it goes back
   with a short note. Show that the YouTube home feed and search still work.
6. **Study mode** (1:45–2:05). In Reel blocking → YouTube study mode → Always: the consent dialog appears → agree →
   add a channel. Play a video from that channel (it plays), then one from another channel (it's paused, with a note).
7. **Turning it off** (2:05–2:15). Android Settings → Accessibility → Quit Engine → off.

Before recording, use a Google test account on the phone, and make sure no personal messages or notifications are
visible.

## Keep in mind

- Changes to what the service reads or does need an update to this declaration, the disclosure screen, the
  service description (`modules/reel-guard/android/src/main/res/values*/strings.xml`) and the privacy policy.
- Android 17's Advanced Protection mode may disable non-accessibility-tool services. That is expected; the app keeps
  working without the counter.
