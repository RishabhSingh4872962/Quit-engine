import { useMemo } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import { BRAND_ACCENT, HABITS } from '../habits';
import { mix } from '../lib/color';
import { storage, THEME_KEY, ThemePref, useActiveHabitId } from '../lib/storage';

export interface Palette {
  scheme: 'light' | 'dark';
  bg: string; // screen background, faintly tinted with the habit accent
  surface: string; // cards
  surfaceAlt: string; // inset areas (segmented controls, tracks)
  text: string;
  textMuted: string;
  border: string;
  accent: string; // buttons, ring
  accentText: string; // accent-coloured text that stays readable on bg
  accentSoft: string; // soft fills (ring track, soft buttons)
  onAccent: string; // text on accent
}

/** Calm & soft palette, derived from a habit's accent so each habit gets its own tint. */
export function makePalette(accent: string, scheme: 'light' | 'dark'): Palette {
  if (scheme === 'dark') {
    const base = '#15141B';
    return {
      scheme,
      bg: mix(accent, '#0E0D13', 0.9),
      surface: mix(accent, base, 0.86),
      surfaceAlt: mix(accent, base, 0.78),
      text: '#F4F2FA',
      textMuted: '#A7A3B8',
      border: mix(accent, base, 0.72),
      accent: mix(accent, '#FFFFFF', 0.1),
      accentText: mix(accent, '#FFFFFF', 0.4),
      accentSoft: mix(accent, base, 0.7),
      onAccent: '#FFFFFF',
    };
  }
  return {
    scheme,
    bg: mix(accent, '#FFFFFF', 0.95),
    surface: '#FFFFFF',
    surfaceAlt: mix(accent, '#FFFFFF', 0.9),
    text: '#1D1B29',
    textMuted: '#6E6A80',
    border: mix(accent, '#FFFFFF', 0.86),
    accent,
    accentText: mix(accent, '#000000', 0.12),
    accentSoft: mix(accent, '#FFFFFF', 0.84),
    onAccent: '#FFFFFF',
  };
}

/** Palette tinted by the selected habit (brand colour before onboarding). */
export function useColors(): Palette {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const id = useActiveHabitId();
  const accent = id ? HABITS[id].accent : BRAND_ACCENT;
  return useMemo(() => makePalette(accent, scheme), [accent, scheme]);
}

/**
 * Applies the user's choice app-wide, including native UI (alerts, pickers).
 * useColorScheme() then reports the override.
 */
export function applyThemePref(pref: ThemePref) {
  Appearance.setColorScheme(pref === 'system' ? 'auto' : pref);
}

export function setThemePref(pref: ThemePref) {
  storage.set(THEME_KEY, pref);
  applyThemePref(pref);
}

/**
 * Baloo 2 (embedded via the expo-font plugin) covers Latin and Devanagari, so Hindi
 * headings match English ones. Android uses the file name as the family name.
 */
export const fonts = {
  display: Platform.select({ ios: 'Baloo2-ExtraBold', default: 'Baloo2_800ExtraBold' }),
  bold: Platform.select({ ios: 'Baloo2-Bold', default: 'Baloo2_700Bold' }),
  semibold: Platform.select({ ios: 'Baloo2-SemiBold', default: 'Baloo2_600SemiBold' }),
};

export const radius = { sm: 12, md: 18, lg: 24, pill: 999 };
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
