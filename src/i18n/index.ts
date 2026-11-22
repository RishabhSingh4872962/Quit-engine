import { createInstance, TFunction } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { AppState } from 'react-native';
import { Lang } from '../habits/types';
import { LANG_KEY, readLangPref, storage } from '../lib/storage';
import { en } from './en';
import { hi } from './hi';

export const resources = { en: { translation: en }, hi: { translation: hi } };

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिंदी' },
];

const deviceLang = (): Lang => (getLocales()[0]?.languageCode === 'hi' ? 'hi' : 'en');

const i18n = createInstance();
void i18n.use(initReactI18next).init({
  resources,
  lng: readLangPref() ?? deviceLang(),
  fallbackLng: 'en',
  initAsync: false, // resources are bundled, so be ready before the first render
  interpolation: { escapeValue: false }, // React already escapes output
});

// Android keeps the app alive when the system language changes. Follow it unless the user chose one.
AppState.addEventListener('change', (state) => {
  if (state === 'active' && !readLangPref() && i18n.language !== deviceLang()) {
    void i18n.changeLanguage(deviceLang());
  }
});

/** Current language, for picking text out of habit configs (`habit.name[lang]`). */
export function useLang(): Lang {
  const { i18n: instance } = useTranslation();
  return instance.language === 'hi' ? 'hi' : 'en';
}

/** 7 → "1 week", 30 → "1 month", 365 → "1 year", anything else → "n days". */
export function milestoneLabel(days: number, t: TFunction) {
  if (days >= 365 && days % 365 === 0) return t('units.year', { count: days / 365 });
  if (days >= 30 && days % 30 === 0) return t('units.month', { count: days / 30 });
  if (days >= 7 && days % 7 === 0) return t('units.week', { count: days / 7 });
  return t('units.day', { count: days });
}

export function setLanguage(lang: Lang) {
  storage.set(LANG_KEY, lang);
  void i18n.changeLanguage(lang);
}

export default i18n;
