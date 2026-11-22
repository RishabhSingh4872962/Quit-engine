import { HabitId } from '../habits/types';
import { requestPermission, syncNotifications } from './notifications';
import {
  CheckinPref,
  readActive,
  readState,
  readTracked,
  writeActive,
  writeCheckin,
  writeMilestoneAlerts,
  writeState,
  writeTracked,
} from './storage';
import { streakDays } from './streak';

/** Every change to habit progress goes through here, so side effects (notifications, sync) have one home. */
export const actions = {
  /** End of onboarding or "add a habit": save answers, start tracking, and show the first new habit. */
  addHabits(entries: { id: HabitId; quizAnswers: Record<string, number> }[]) {
    if (!entries.length) return;
    for (const { id, quizAnswers } of entries) writeState(id, { quizAnswers });
    const tracked = readTracked();
    writeTracked([...tracked, ...entries.map((e) => e.id).filter((id) => !tracked.includes(id))]);
    writeActive(entries[0].id);
  },

  /** Stops tracking a habit. Its data is kept, so adding it back restores the streak. */
  removeHabit(id: HabitId) {
    const remaining = readTracked().filter((h) => h !== id);
    if (!remaining.length) return; // always keep at least one
    writeTracked(remaining);
    if (readActive() === undefined || readActive() === id) writeActive(remaining[0]);
    void syncNotifications();
  },

  setActive(id: HabitId) {
    writeActive(id);
  },

  async startStreak(id: HabitId) {
    writeState(id, { streakStart: Date.now(), celebrated: 0 });
    // Ask at a meaningful moment rather than on first launch.
    await requestPermission();
    await syncNotifications();
  },

  relapse(id: HabitId) {
    const s = readState(id);
    const now = Date.now();
    writeState(id, {
      relapses: [...s.relapses, now],
      streakStart: now,
      bestStreakDays: Math.max(s.bestStreakDays, streakDays(s.streakStart, now)),
      celebrated: 0,
    });
    void syncNotifications();
  },

  resistUrge(id: HabitId) {
    writeState(id, { urgesResisted: readState(id).urgesResisted + 1 });
  },

  markCelebrated(id: HabitId, milestone: number) {
    writeState(id, { celebrated: milestone });
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
