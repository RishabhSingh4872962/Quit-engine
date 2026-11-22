import { useLocales } from 'expo-localization';
import { Lang } from '../habits/types';

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिंदी' },
];

/** Device's primary language if supported, else English. Re-renders if the OS language changes. */
export function useDeviceLang(): Lang {
  const [primary] = useLocales();
  return primary.languageCode === 'hi' ? 'hi' : 'en';
}

/**
 * Shared UI strings. Habit-specific text (names, quiz, taglines) lives in the habit config instead.
 * Use {name} placeholders for values, filled in by t().
 */
const STRINGS = {
  days: { en: 'days', hi: 'दिन' },
  nextMilestone: { en: 'Next milestone: {n} days', hi: 'अगला लक्ष्य: {n} दिन' },
  startStreak: { en: 'Start streak', hi: 'शुरू करें' },
  urgeButton: { en: "I'm having an urge", hi: 'मुझे तलब हो रही है' },
  slipped: { en: 'I slipped', hi: 'मुझसे चूक हो गई' },
  breatheIn: { en: 'Breathe in', hi: 'साँस अंदर' },
  hold: { en: 'Hold', hi: 'रोकें' },
  breatheOut: { en: 'Breathe out', hi: 'साँस बाहर' },
  wellDone: { en: 'Well done!', hi: 'शाबाश!' },
  urgePassed: { en: 'Did the urge pass?', hi: 'क्या तलब कम हुई?' },
  yes: { en: 'Yes', hi: 'हाँ' },
  notYet: { en: 'Not yet', hi: 'अभी नहीं' },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof STRINGS;

export const t = (lang: Lang, key: StringKey, vars: Record<string, string | number> = {}) =>
  STRINGS[key][lang].replace(/\{(\w+)\}/g, (match, name: string) => String(vars[name] ?? match));
