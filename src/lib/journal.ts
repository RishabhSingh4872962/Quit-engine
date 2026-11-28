import { useMemo } from 'react';
import { useMMKVString } from 'react-native-mmkv';
import type { TFunction } from 'i18next';
import { HabitConfig, HabitId, Lang } from '../habits/types';
import { localDay } from './reels';
import { storage } from './storage';
import { DAY_MS } from './streak';

/**
 * Journal, per habit, stored only on this phone: never uploaded, not part of the cloud backup,
 * and nothing from it goes to analytics (triggers, moods and notes would reveal the habit).
 * - Urge diary: when an urge came, what set it off, how strong it was (after the urge exercise).
 * - Days: the daily promise and the evening check-in (mood, promise kept, a private note).
 */

export interface UrgeEntry {
  at: number; // epoch ms
  trigger?: string; // a shared trigger id (bored…) or one from the habit config
  strength?: number; // 1 (mild) – 5 (very strong)
}

export interface DayEntry {
  pledgedAt?: number; // made the day's promise (epoch ms)
  mood?: number; // 1–5
  kept?: boolean; // kept the promise
  note?: string;
  checkedAt?: number; // evening check-in (epoch ms)
}

export const SHARED_TRIGGERS = ['bored', 'stressed', 'lonely', 'tired', 'anxious'] as const;
export const MOODS = ['😣', '🙁', '😐', '🙂', '😄'] as const; // mood 1–5
export const MOOD_NAMES = ['rough', 'low', 'okay', 'good', 'great'] as const; // i18n keys, same order
export const NOTE_MAX = 280;
/** From this hour, Home asks for the evening check-in instead of the promise. */
export const EVENING_HOUR = 18;
export const DAY_PARTS = ['morning', 'afternoon', 'evening', 'night'] as const;
export type DayPart = (typeof DAY_PARTS)[number];

const KEEP_DAYS = 90;
const MAX_URGES = 500;

const urgesKey = (id: HabitId) => `journal.urges.${id}`;
const daysKey = (id: HabitId) => `journal.days.${id}`;

const parseUrges = (raw: string | undefined): UrgeEntry[] => {
  try {
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((u): u is UrgeEntry => typeof u?.at === 'number') : [];
  } catch {
    return [];
  }
};

const parseDays = (raw: string | undefined): Record<string, DayEntry> => {
  try {
    const v: unknown = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, DayEntry>) : {};
  } catch {
    return {};
  }
};

export const readUrges = (id: HabitId) => parseUrges(storage.getString(urgesKey(id)));
export const readDays = (id: HabitId) => parseDays(storage.getString(daysKey(id)));

/** Adds an urge; entries older than 90 days (or past the newest 500) are dropped. */
export function addUrge(id: HabitId, entry: UrgeEntry) {
  const cutoff = entry.at - KEEP_DAYS * DAY_MS;
  const list = [...readUrges(id).filter((u) => u.at >= cutoff), entry].slice(-MAX_URGES);
  storage.set(urgesKey(id), JSON.stringify(list));
}

/** Updates one day (YYYY-MM-DD); days older than 90 days are dropped. */
export function writeDay(id: HabitId, day: string, patch: Partial<DayEntry>) {
  const days = readDays(id);
  const keep = new Set(lastDays(KEEP_DAYS, Date.now()));
  const next: Record<string, DayEntry> = {};
  for (const [d, e] of Object.entries(days)) if (keep.has(d)) next[d] = e;
  next[day] = { ...days[day], ...patch };
  storage.set(daysKey(id), JSON.stringify(next));
}

export function clearJournal(id: HabitId) {
  storage.remove(urgesKey(id));
  storage.remove(daysKey(id));
}

export function useUrges(id: HabitId): UrgeEntry[] {
  const [raw] = useMMKVString(urgesKey(id), storage);
  return useMemo(() => parseUrges(raw), [raw]);
}

export function useJournalDays(id: HabitId): Record<string, DayEntry> {
  const [raw] = useMMKVString(daysKey(id), storage);
  return useMemo(() => parseDays(raw), [raw]);
}

/** The last n local days (YYYY-MM-DD), oldest first, ending today. Steps by calendar day (DST-safe). */
export function lastDays(n: number, now: number) {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.unshift(localDay(d.getTime()));
    d.setDate(d.getDate() - 1);
  }
  return out;
}

/** The day an evening check-in belongs to: just after midnight still counts as the evening before. */
export const checkInDay = (now: number) => localDay(new Date(now).getHours() < 4 ? now - 5 * 3_600_000 : now);

export function dayPart(time: number): DayPart {
  const h = new Date(time).getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/** Days in a row with a promise, up to today. Not having made today's yet doesn't break the run. */
export function pledgeStreak(days: Record<string, DayEntry>, now: number) {
  let n = 0;
  for (const [i, day] of lastDays(KEEP_DAYS, now).reverse().entries()) {
    if (days[day]?.pledgedAt) n++;
    else if (i > 0) break;
  }
  return n;
}

/** Shared triggers first, then the habit's own. */
export function triggerOptions(habit: HabitConfig, lang: Lang, t: TFunction) {
  return [
    ...SHARED_TRIGGERS.map((id) => ({ id, label: t(`journal.triggers.${id}`) })),
    ...(habit.triggers ?? []).map((tr) => ({ id: tr.id, label: tr.label[lang] })),
  ];
}

const average = (urges: UrgeEntry[]) => {
  const xs = urges.flatMap((u) => (u.strength ? [u.strength] : []));
  return xs.length >= 3 ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined; // too few to say
};

/** Patterns for the last n days, compared with the n days before. */
export function journalInsights(urges: UrgeEntry[], days: Record<string, DayEntry>, n: number, now: number) {
  const all = lastDays(2 * n, now);
  const current = new Set(all.slice(n));
  const previous = new Set(all.slice(0, n));
  const cur = urges.filter((u) => current.has(localDay(u.at)));
  const prev = urges.filter((u) => previous.has(localDay(u.at)));

  const parts: Record<DayPart, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const u of cur) parts[dayPart(u.at)]++;
  const peak = cur.length >= 3 ? DAY_PARTS.reduce((a, b) => (parts[b] > parts[a] ? b : a)) : undefined;

  const byTrigger = new Map<string, number>();
  for (const u of cur) if (u.trigger) byTrigger.set(u.trigger, (byTrigger.get(u.trigger) ?? 0) + 1);
  const triggers = [...byTrigger.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ id, count }));

  const checkIns = all.slice(n).filter((d) => days[d]?.kept !== undefined);
  return {
    urges: cur.length,
    parts,
    peak,
    triggers,
    strength: average(cur),
    prevStrength: average(prev),
    checkIns: checkIns.length,
    kept: checkIns.filter((d) => days[d]?.kept).length,
  };
}
