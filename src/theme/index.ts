import { useMemo } from 'react';
import { Appearance, Platform, TextStyle } from 'react-native';
import { BRAND_ACCENT, HABITS } from '../habits';
import { mix, withAlpha } from '../lib/color';
import { useActiveHabitId } from '../lib/storage';

/**
 * "Midnight": the app's one look. Near-black ground, soft glass-like surfaces, and the selected
 * habit's colour as a glowing accent (each habit keeps its own colour). Dark only, by design.
 */
export interface Palette {
  scheme: 'dark';
  bg: string; // screen background
  surface: string; // cards and tiles
  surfaceAlt: string; // inset areas: tracks, chips, segmented controls, inputs
  surfaceHigh: string; // raised elements on a surface (selected segment, pressed rows)
  text: string;
  textMuted: string; // secondary text (passes 4.5:1 on bg and surface)
  border: string; // hairlines around surfaces
  accent: string; // buttons, rings, active states
  accentText: string; // accent-coloured text, readable on dark
  accentSoft: string; // soft fills behind accent icons and chips
  accentLight: string; // light end of gradients
  accentDeep: string; // dark end of gradients (the orb's edge)
  glow: string; // coloured shadow / halo
  onAccent: string; // text on accent
  success: string;
  danger: string;
}

export const BG = '#0A0A12';

/** The Midnight palette, tinted by a habit's accent. `_scheme` is ignored (dark only). */
export function makePalette(accent: string, _scheme?: 'light' | 'dark'): Palette {
  return {
    scheme: 'dark',
    bg: BG,
    surface: '#14141F',
    surfaceAlt: '#1D1D2C',
    surfaceHigh: '#272739',
    text: '#F4F3FA',
    textMuted: '#A3A1B8',
    border: '#22222F',
    accent: mix(accent, '#FFFFFF', 0.08),
    accentText: mix(accent, '#FFFFFF', 0.5),
    accentSoft: mix(accent, BG, 0.76),
    accentLight: mix(accent, '#FFFFFF', 0.38),
    accentDeep: mix(accent, '#000000', 0.55),
    glow: withAlpha(accent, 0.45),
    onAccent: '#FFFFFF',
    success: '#4ADE80',
    danger: '#F87171',
  };
}

/** Palette tinted by the selected habit (brand colour before onboarding). */
export function useColors(): Palette {
  const id = useActiveHabitId();
  const accent = id ? HABITS[id].accent : BRAND_ACCENT;
  return useMemo(() => makePalette(accent), [accent]);
}

/** Native UI (alerts, pickers, the keyboard) follows the app's dark look. */
export function applyThemePref(_pref?: unknown) {
  Appearance.setColorScheme('dark');
}

/** Kept for older callers; the app is dark only. */
export function setThemePref(_pref?: unknown) {
  applyThemePref();
}

/**
 * Poppins (embedded via the expo-font plugin) covers Latin and Devanagari, so Hindi matches
 * English. Android uses the file name as the family name; one family per weight.
 */
export const fonts = {
  regular: Platform.select({ ios: 'Poppins-Regular', default: 'Poppins_400Regular' }),
  medium: Platform.select({ ios: 'Poppins-Medium', default: 'Poppins_500Medium' }),
  semibold: Platform.select({ ios: 'Poppins-SemiBold', default: 'Poppins_600SemiBold' }),
  bold: Platform.select({ ios: 'Poppins-Bold', default: 'Poppins_700Bold' }),
  display: Platform.select({ ios: 'Poppins-ExtraBold', default: 'Poppins_800ExtraBold' }),
};

/** The Poppins family for a CSS-style weight (custom fonts on Android ignore fontWeight). */
export function fontFor(weight: TextStyle['fontWeight'] | undefined) {
  const w = typeof weight === 'number' ? weight : weight === 'bold' ? 700 : Number(weight ?? 400);
  if (w >= 800) return fonts.display;
  if (w >= 700) return fonts.bold;
  if (w >= 600) return fonts.semibold;
  if (w >= 500) return fonts.medium;
  return fonts.regular;
}

export const radius = { sm: 12, md: 18, lg: 22, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 16, lg: 20, xl: 32 };

/** Coloured glow under the main button and the orb (RN boxShadow, new architecture). */
export const glowShadow = (color: string, blur = 30, y = 10) => `0px ${y}px ${blur}px ${color}`;
