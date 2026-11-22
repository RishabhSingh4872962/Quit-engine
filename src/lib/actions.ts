import { HabitId } from '../habits/types';
import { requestPermission, syncNotifications } from './notifications';
import {
  storage,
  CheckinPref,
  readActive,
  readScreenTimeOff,
  readState,
  readTracked,
  writeActive,
  writeCheckin,
  writeMilestoneAlerts,
  writePaywallOffered,
  writeScreenTimeOff,
  writeState,
  writeTracked,
} from './storage';
import { streakDays } from './streak';
import { HABITS } from '../habits';
import {
  dayTotals,
  endOfDay,
  localDay,
  openReelSettings,
  readReelDays,
  readReelLimit,
  reelCounterAvailable,
  resetReelPausesToday,
  syncReelLimit,
  writeReelBubble,
  writeReelConsent,
  writeReelLimit,
} from './reels';
import { track } from './telemetry';
import { updateStreakWidget } from '../widget';

const BASE_DAY_KEY = 'reels.baseDay';
const BASE_COUNT_KEY = 'reels.baseCount';

/** Remembers today's reel count, so the streak check only counts reels watched after now (today). */
function markReelBase() {
  const today = readReelDays(1).at(-1);
  const apps = Object.values(HABITS).flatMap((h) => h.reelApps?.map((a) => a.id) ?? []);
  storage.set(BASE_DAY_KEY, localDay(Date.now()));
  storage.set(BASE_COUNT_KEY, dayTotals(today, apps).count);
}

/** Every change to habit progress goes through here, so side effects (notifications, sync) have one home. */
export const actions = {
  /** End of onboarding or "add a habit": save answers, start tracking, and show the first new habit. */
  addHabits(entries: { id: HabitId; quizAnswers: Record<string, number> }[]) {
    if (!entries.length) return;
    for (const { id, quizAnswers } of entries) writeState(id, { quizAnswers });
    const tracked = readTracked();
    const next = [...tracked, ...entries.map((e) => e.id).filter((id) => !tracked.includes(id))];
    writeTracked(next);
    writeActive(entries[0].id);
    track(tracked.length ? 'habit_added' : 'onboarding_complete', { habit_count: next.length });
    updateStreakWidget();
  },

  /** Stops tracking a habit. Its data is kept, so adding it back restores the streak. */
  removeHabit(id: HabitId) {
    const remaining = readTracked().filter((h) => h !== id);
    if (!remaining.length) return; // always keep at least one
    writeTracked(remaining);
    if (readActive() === undefined || readActive() === id) writeActive(remaining[0]);
    track('habit_removed', { habit_count: remaining.length });
    void syncNotifications();
    updateStreakWidget();
  },

  setActive(id: HabitId) {
    writeActive(id);
    updateStreakWidget(); // the widget follows the selected habit
  },

  async startStreak(id: HabitId) {
    writeState(id, { streakStart: Date.now(), celebrated: 0 });
    if (HABITS[id].reelApps) markReelBase(); // reels already watched today don't count against the new streak
    track('streak_started');
    updateStreakWidget();
    // Ask at a meaningful moment rather than on first launch.
    await requestPermission();
    await syncNotifications();
  },

  /** A slip, now or (for automatic reel-limit slips found later) at the end of an earlier day. */
  relapse(id: HabitId, now = Date.now()) {
    const s = readState(id);
    const days = streakDays(s.streakStart, now);
    writeState(id, {
      relapses: [...s.relapses, now],
      streakStart: now,
      bestStreakDays: Math.max(s.bestStreakDays, days),
      pastDaysFree: s.pastDaysFree + days, // the days still count
      celebrated: 0,
    });
    track('slip_logged');
    void syncNotifications();
    updateStreakWidget();
  },

  resistUrge(id: HabitId) {
    writeState(id, { urgesResisted: readState(id).urgesResisted + 1 });
    track('urge_exercise_done');
  },

  markCelebrated(id: HabitId, milestone: number) {
    writeState(id, { celebrated: milestone });
    track('milestone_reached', { days: milestone });
  },

  /** Daily reel limit (0 = off). The native service nudges and pauses based on it. */
  setReelLimit(limit: number) {
    writeReelLimit(limit);
    syncReelLimit();
    resetReelPausesToday(); // a new limit means fresh rules for today
    markReelBase(); // reels already watched today don't count against the new limit
  },

  /** Live counter bubble while watching reels. */
  setReelBubble(on: boolean) {
    writeReelBubble(on);
    syncReelLimit();
  },

  /** Undo "No more pauses today". */
  resumeReelPauses() {
    resetReelPausesToday();
  },

  /**
   * Automatic reel-free streak: a day over the daily limit ends the streak of each tracked habit
   * that counts reels. Checked when the app opens; recorded once per day. On the day the streak
   * starts or the limit changes, only reels after that moment count (see markReelBase).
   */
  checkReelLimit() {
    const limit = readReelLimit();
    if (!limit || !reelCounterAvailable) return;
    const days = readReelDays(60);
    const today = localDay(Date.now());
    for (const id of readTracked()) {
      const apps = HABITS[id].reelApps?.map((a) => a.id);
      const s = readState(id);
      if (!apps || s.streakStart === null) continue;
      const startDay = localDay(s.streakStart);
      const lastSlip = storage.getString(`reels.slipDay.${id}`) ?? '';
      for (let i = days.length - 1; i >= 0; i--) {
        const d = days[i];
        if (d.day < startDay || d.day <= lastSlip) break;
        const before = d.day === storage.getString(BASE_DAY_KEY) ? storage.getNumber(BASE_COUNT_KEY) ?? 0 : 0;
        if (dayTotals(d, apps).count - before <= limit) continue;
        storage.set(`reels.slipDay.${id}`, d.day);
        this.relapse(id, d.day === today ? Date.now() : endOfDay(d.day));
        break;
      }
    }
  },

  /** Agreed on the reel-counter disclosure: remember consent, then open Accessibility settings. */
  agreeToReelCounting() {
    writeReelConsent();
    openReelSettings();
  },

  /** The after-onboarding Premium offer is shown at most once. */
  markPaywallOffered() {
    writePaywallOffered();
  },

  /** Count (or stop counting) an app in Reels screen time. No analytics: it would hint at the habit. */
  setScreenTimeApp(packageId: string, counted: boolean) {
    const off = readScreenTimeOff().filter((p) => p !== packageId);
    writeScreenTimeOff(counted ? off : [...off, packageId]);
  },

  async setCheckin(patch: Partial<CheckinPref>) {
    writeCheckin(patch);
    if (patch.enabled) await requestPermission();
    await syncNotifications();
  },

  async setMilestoneAlerts(on: boolean) {
    writeMilestoneAlerts(on);
    if (on) await requestPermission();
    await syncNotifications();
  },
};
