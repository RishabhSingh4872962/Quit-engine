# Designing new screens with Google Stitch

Stitch (stitch.withgoogle.com) makes mobile screens from a text prompt. To keep its screens in the app's
"Midnight" look:

1. Start a new **App** (mobile) project.
2. Give it the design rules: attach or paste `docs/design/DESIGN.md` (Stitch can import a DESIGN.md as the
   project's design system; if that option isn't there, paste the file's text at the top of the first prompt).
3. Paste the base prompt below, then one screen prompt at a time.
4. Treat the result as a sketch: rebuild it with the app's own components (`Card`, `Button`, `Group`/`Row`,
   `Orb`, `GlowMark`, `Segmented`, `ToggleRow`, `TextField`) so it stays in one style and in both languages.

## Base prompt

```
Mobile app "Quit Engine", Android, dark only. A private habit tracker for quitting habits like endless
reels, smoking/gutka or nail biting. Audience: India, ages 16–30, English and Hindi (Devanagari).
Look: "Midnight". Near-black blue background #0A0A12, cards #14141F with a 1 px border #22222F and
22 px corners, inset areas #1D1D2C. One accent colour per screen: purple #6C5CE7 (it changes per habit).
The accent is used as a soft glow: a radial-gradient orb, a gradient pill button (light to full accent)
with a coloured shadow. Font Poppins; big bold white numbers, small muted units (#A3A1B8).
Floating pill tab bar at the bottom (icons only): Home, Focus, Rooms, Progress, Settings.
Calm, private, gentle, never shaming. No emoji icons, no stock photos, no medical words.
Follow the attached DESIGN.md exactly.
```

## Screen prompts

- **Home**: `Home screen: habit pill with chevron top-left, journal and share icon buttons top-right, a
  one-line tagline, a large glowing orb with "12" and "days" inside and a thin progress ring, a status pill
  "2 days to the 2-week milestone", a full-width gradient button "I'm having an urge", a ghost text button
  "I slipped", then a 2x2 grid of small cards: urges resisted, best streak, today's promise, your plant.`
- **Urge moment**: `Full-screen urge screen: darkest background, one large breathing circle with a soft
  glow in the centre, the words "Breathe in" inside, a small step counter "1 of 4", and at the bottom a
  quiet "I'm okay now" button. Very few words.`
- **Focus**: `Focus timer: a large ring with a gradient arc and "25:00" inside, a segmented control
  Timer / Pomodoro / Stopwatch, chips for 15 / 25 / 45 / 60 min, a gradient "Start focus" button, and a
  collapsed "Session options" card with a summary line.`
- **Progress**: `Progress screen: "Next milestone" card with "2 weeks", a gradient progress bar and "3 days
  to go", a card with a small illustrated plant growing in a pot, then one card with a vertical timeline of
  milestones (done ones with a check in an accent circle, the next one glowing, later ones as dim dots).`
- **A new feature**: start with `New screen for <feature> in the same app and style:` and describe what
  the person sees and the one main action.

Stitch's output is a reference, not code to copy: check text contrast (4.5:1), touch targets (44 px) and
that every label still fits in Hindi.
