import type { TFunction } from 'i18next';

/** 72 min -> "1h 12m", 5 min -> "5m", 20 s -> "<1m" (localised). */
export function formatDuration(ms: number, t: TFunction) {
  if (ms > 0 && ms < 30_000) return t('common.underMinute');
  const mins = Math.round(ms / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? t('common.hm', { h, m }) : t('common.m', { m });
}
