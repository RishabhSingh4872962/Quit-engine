import { readState, writeState } from './storage';
import { streakDays } from './streak';

/** Every change to habit progress goes through here, so side effects (notifications, sync) have one home. */
export const actions = {
  finishQuiz(quizAnswers: Record<string, number>) {
    writeState({ quizAnswers });
  },

  startStreak() {
    writeState({ streakStart: Date.now(), celebrated: 0 });
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
  },

  resistUrge() {
    writeState({ urgesResisted: readState().urgesResisted + 1 });
  },
};
