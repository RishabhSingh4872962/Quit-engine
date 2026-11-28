# Quit Engine — "Midnight" design system

The app's one look, chosen 28 Nov 2026 from three directions (Midnight, Garden, Clean). Dark only.
Use this file when designing new screens, and import it into AI design tools (e.g. Google Stitch's
DESIGN.md import) so generated screens match the app. Code: `src/theme/index.ts`, `src/components/`.

## Feel

Calm, premium, private. A near-black night sky with one warm glow: the habit's own colour. Think a
quiet room with a lamp on, not a dashboard. Gentle and never shaming, especially around slips.
India-first: every screen must work in English and Hindi (Devanagari).

## Colour

| Token | Value | Use |
|---|---|---|
| `bg` | `#0A0A12` | screen background (blue-black, never pure black) |
| `surface` | `#14141F` | cards and tiles |
| `surfaceAlt` | `#1D1D2C` | inset areas: inputs, chips, tracks, segmented controls, soft buttons |
| `surfaceHigh` | `#272739` | raised on a surface: selected segment, pressed rows, switch track |
| `border` | `#22222F` | 1 px hairline around every surface |
| `text` | `#F4F3FA` | primary text |
| `textMuted` | `#A3A1B8` | secondary text (passes 4.5:1 on bg and surface) |
| `success` | `#4ADE80` | done states (promise kept) |
| `danger` | `#F87171` | errors, wrong answers |

Each habit has an accent (Reels `#6C5CE7` purple, Nicotine `#00B894` teal, No contact pink, Nail biting blue,
Skin picking orange). The whole UI takes the selected habit's accent:

- `accent` = accent + 8% white: buttons, rings, active states
- `accentText` = accent + 50% white: accent-coloured text and icons on dark
- `accentSoft` = accent mixed 76% into `bg`: soft fills behind icons, active tab pill
- `accentLight` = accent + 38% white / `accentDeep` = accent + 55% black: gradient ends
- `glow` = accent at 45% alpha: coloured shadows and halos

Rules: one accent per screen. Gradients only on the main button (left `accentLight` → right `accent`) and
the streak orb (radial). No rainbow, no gradient backgrounds beyond the soft halo behind the orb.

## Type

Poppins everywhere (Latin + Devanagari in one family). Weights 400/500/600/700/800.

| Style | Size / line | Weight |
|---|---|---|
| display (streak number) | 72 / 80, tracking −2 | 800 |
| title (screen title) | 28 / 38, tracking −0.4 | 700 |
| heading (card title) | 18 / 26 | 600 |
| body | 15 / 23 | 400 |
| muted (secondary) | 14 / 21 | 400, `textMuted` |
| caption | 12.5 / 18 | 400, `textMuted` |
| label (section label) | 11.5 / 16, uppercase, tracking 0.9 | 600, `textMuted` |

Numbers are the heroes: big, bold, white; units small and muted beside them ("12 days").

## Shape and space

Radius: 12 (small), 18 (inputs, rows), 22 (cards, tiles), 28 (sheets), pill (buttons, chips, tab bar).
Spacing: screen gutter 20; 12 between tiles; 16–24 between sections. Touch targets ≥ 44 px.
Depth comes from lighter surfaces and 1 px borders, not drop shadows. The only shadows are the
accent glow (main button, orb) and the floating tab bar's dark shadow.

## Components

- **Primary button**: full-width pill, 58 high, gradient `accentLight → accent`, white 16/600 label with an
  optional leading icon, soft `glow` shadow. One per screen (the main action).
- **Soft button**: pill, `surfaceAlt` with border, `accentText` label. **Ghost**: text only, `textMuted`.
- **Card**: `surface`, 1 px `border`, radius 22, padding 18.
- **Tile** (Home grid): a small card, icon in a 32 px `accentSoft` circle, big value (19/700) with a small muted
  unit, caption label. Two per row.
- **Streak orb**: a radial-gradient sphere (`accentLight` highlight top-left → `accent` → `accentDeep` edge), a
  wide `glow`, the number inside in white 800, a thin ring around it (`accentText` arc on a 7% white track)
  filling toward the next milestone. Breathes slowly (scale ±2.5%), still with reduced motion.
- **Status chip**: pill on `surfaceAlt` with a tiny progress bar and a caption.
- **Habit pill**: the current habit (icon + name + chevron) at top-left of Home; opens a bottom sheet to switch
  or add a habit.
- **Bottom sheet**: `surface`, top radius 28, grabber, rows with a 42 px coloured icon circle.
- **Segmented control**: pill track `surfaceAlt`, sliding `surfaceHigh` thumb.
- **Chips**: pill, `surfaceAlt`; selected = `accent` with white text.
- **Switch rows**: the whole row toggles; track `surfaceHigh` → `accent`.
- **Grouped list** (Settings, `components/Group.tsx`): a section label, then one card whose rows are split by
  inset hairlines. Row = 34 px icon circle (`accentSoft`, or the habit's own colour), title 15.5/600, caption
  subtitle, then a muted value and a chevron when it opens something. Destructive rows use `danger`.
  Explanations go under the card as a caption, not inside every row.
- **Tab bar**: floating dark pill (`#161622`, border, deep shadow), 16 px from the sides, icons only
  (labels for screen readers); the active tab sits on an `accentSoft` pill. Tabs: Home, Focus, Rooms,
  Progress (milestones + plant), Settings.

## Screens (patterns)

- **Home**: habit pill + journal/share icons; tagline; the orb as hero with the status chip; the urge
  button and "I slipped" (ghost) right below, above the fold; a 2×2 "today" grid (urges resisted, best
  streak, today's promise / evening check-in, the plant); habit-specific cards below (reels today, money saved,
  screen time).
- **Urge / pause moments**: full-screen, darkest background, one breathing visual centred, very few words, the
  way out always visible.
- **Lists and settings**: grouped cards with section labels, not one long wall of cards.

## Motion

Short and soft: fade-in + 8–12 px rise on entering (400–600 ms, staggered 50–150 ms); springs on press
(scale 0.97). Haptics on choices. Respect reduced motion (no breathing, no long animations).

## Words

Gentle, plain, short. "I slipped" not "I failed"; "That's okay" after slips; never medical claims.
Notifications never name the habit. Hindi copy gender-neutral where possible.

## Don't

Pure black or pure white backgrounds; more than one accent; text below 4.5:1 contrast; emoji as icons
(mood faces in the journal are the only exception); walls of identical cards; hiding the main action
below the fold.
