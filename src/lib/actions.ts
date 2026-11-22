import { HabitId } from '../habits/types';
import { requestPermission, syncNotifications } from './notifications';
import {
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
import { track } from './telemetry';
import { updateStreakWidget } from '../widget';

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
    track('streak_started');
    updateStreakWidget();
    // Ask at a meaningful moment rather than on first launch.
    await requestPermission();
    await syncNotifications();
  },

  relapse(id: HabitId) {
    const s = readState(id);
    const now = Date.now();
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
