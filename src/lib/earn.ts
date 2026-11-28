import { useMMKVString } from 'react-native-mmkv';
import { HABIT_LIST } from '../habits';
import { allowMoreReelsToday, localDay } from './reels';
import { storage } from './storage';
import { DAY_MS } from './streak';

/**
 * Earned reels: extra reels for today, earned on the pause screen with a short focus session or a
 * round of questions. Unlike "5 more", they raise today's limit, so they don't end the reel-free
 * streak. Kept per day on the phone (60 days, for the streak check). Nothing goes to analytics.
 */

export const EARN_FOCUS_MINUTES = 10;
export const EARN_FOCUS_REELS = 5;
export const EARN_LEARN_REELS = 3;
export const EARN_CAP = 15; // per day, so earning can't replace the limit

const KEY = 'reels.earned'; // { 'YYYY-MM-DD': reels }
const KEEP_DAYS = 60;

const parse = (raw: string | undefined): Record<string, number> => {
  try {
    const v: unknown = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
};

const reelAppIds = () => HABIT_LIST.flatMap((h) => h.reelApps?.map((a) => a.id) ?? []);

/** Reels earned on a day (YYYY-MM-DD). */
export const readEarned = (day: string) => parse(storage.getString(KEY))[day] ?? 0;

export function useEarnedToday(now: number) {
  const [raw] = useMMKVString(KEY, storage);
  return parse(raw)[localDay(now)] ?? 0;
}

/** Adds up to n reels to today's limit (within the daily cap). Returns how many were added. */
export function earnReels(n: number, now = Date.now()) {
  const log = parse(storage.getString(KEY));
  const day = localDay(now);
  const add = Math.max(0, Math.min(n, EARN_CAP - (log[day] ?? 0)));
  if (!add) return 0;
  const cutoff = localDay(now - KEEP_DAYS * DAY_MS);
  for (const d of Object.keys(log)) if (d < cutoff) delete log[d];
  log[day] = (log[day] ?? 0) + add;
  storage.set(KEY, JSON.stringify(log));
  allowMoreReelsToday(add, reelAppIds()); // the next pause moves back by as many reels
  return add;
}
