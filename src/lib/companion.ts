import { useMMKVNumber } from 'react-native-mmkv';
import { localDay } from './reels';
import { readState, readTracked, storage } from './storage';
import { DAY_MS } from './streak';

/**
 * The growing companion: one plant for the whole app, only on this phone. It grows with care points
 * from things that already happen (urges resisted, the daily promise, check-ins, focus minutes, days
 * on track). It never loses growth: after a slip, or a few quiet days, it rests, then perks up again.
 */

/** Points needed for each stage: seed, sprout, seedling, young plant, bush, in flower, tree. */
export const STAGES = [0, 10, 30, 70, 150, 300, 600] as const;
export const STAGE_NAMES = ['seed', 'sprout', 'seedling', 'young', 'bush', 'flowering', 'tree'] as const;
export const CARE = { urge: 3, pledge: 1, checkin: 2, day: 4, focusPer: 5 } as const; // focus: 1 point per 5 min

const POINTS_KEY = 'companion.points';
const DAY_KEY = 'companion.dayAwarded'; // last day "days on track" were counted
const CARE_KEY = 'companion.lastCare'; // epoch ms of the last care
const REST_AFTER_SLIP = DAY_MS;
const REST_AFTER_QUIET = 3 * DAY_MS;

const readPoints = () => storage.getNumber(POINTS_KEY) ?? 0;

export function addCare(points: number) {
  if (points <= 0) return;
  storage.set(POINTS_KEY, readPoints() + Math.round(points));
  storage.set(CARE_KEY, Date.now());
}

/** Whole days between two YYYY-MM-DD days. */
const daysBetween = (a: string, b: string) => {
  const t = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((t(b) - t(a)) / DAY_MS);
};

/**
 * Days on track since the last count (call when the app starts). Only days after the latest streak
 * (re)start count, so a slip day never adds growth; nothing is ever taken away.
 */
export function awardDaysOnTrack(now = Date.now()) {
  const today = localDay(now);
  const last = storage.getString(DAY_KEY);
  storage.set(DAY_KEY, today);
  if (!last || last >= today) return;
  const starts = readTracked().map((id) => readState(id).streakStart).filter((s): s is number => s !== null);
  if (!starts.length) return;
  const from = [last, localDay(Math.max(...starts))].sort().at(-1) ?? last;
  addCare(Math.max(0, daysBetween(from, today)) * CARE.day);
}

export function stageOf(points: number) {
  let stage = 0;
  for (const [i, min] of STAGES.entries()) if (points >= min) stage = i;
  const next = STAGES[stage + 1] as number | undefined;
  const progress = next === undefined ? 1 : (points - STAGES[stage]) / (next - STAGES[stage]);
  return { stage, next, progress };
}

/** Resting after a slip in the last day, or after three days without any care. */
export function isResting(now: number) {
  const lastSlip = Math.max(0, ...readTracked().flatMap((id) => readState(id).relapses));
  const lastCare = storage.getNumber(CARE_KEY) ?? now;
  return now - lastSlip < REST_AFTER_SLIP || now - lastCare > REST_AFTER_QUIET;
}

export function useCompanion(now: number) {
  const [points] = useMMKVNumber(POINTS_KEY, storage);
  const p = points ?? 0;
  return { points: p, ...stageOf(p), resting: isResting(now) };
}
