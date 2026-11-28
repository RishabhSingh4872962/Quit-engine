import type { TFunction } from 'i18next';

/** 72 min -> "1h 12m", 60 min -> "1h", 5 min -> "5m", 20 s -> "<1m" (localised). */
export function formatDuration(ms: number, t: TFunction) {
  if (ms > 0 && ms < 30_000) return t('common.underMinute');
  const mins = Math.round(ms / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return m ? t('common.hm', { h, m }) : t('common.h', { h });
  return t('common.m', { m });
}

/** m:ss, rounded up, so a countdown never shows 0:00 before the end. */
export function clock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
