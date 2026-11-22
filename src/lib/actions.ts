import { requestPermission, syncNotifications } from './notifications';
import { CheckinPref, readState, writeCheckin, writeMilestoneAlerts, writeState } from './storage';
import { streakDays } from './streak';

/** Every change to habit progress goes through here, so side effects (notifications, sync) have one home. */
export const actions = {
  finishQuiz(quizAnswers: Record<string, number>) {
    writeState({ quizAnswers });
  },

  async startStreak() {
    writeState({ streakStart: Date.now(), celebrated: 0 });
    // Ask at a meaningful moment rather than on first launch.
    await requestPermission();
    await syncNotifications();
  },

  relapse() {
    const s = readState();
    const now = Date.now();
    writeState({
      relapses: [...s.relapses, now],
      streakStart: now,
      bestStreakDays: Math.max(s.bestStreakDays, streakDays(s.streakStart, now)),
      celebrated: 0,
    });
    void syncNotifications();
  },

  resistUrge() {
    writeState({ urgesResisted: readState().urgesResisted + 1 });
  },

  markCelebrated(milestone: number) {
    writeState({ celebrated: milestone });
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
