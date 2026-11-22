import 'i18next';
import type { en } from './en';

// Type-checked translation keys: t('home.startStreak') autocompletes, typos fail tsc.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
