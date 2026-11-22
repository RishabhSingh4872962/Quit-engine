import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { getCrashlytics, log, recordError } from '@react-native-firebase/crashlytics';

/**
 * Analytics events. Names and params are deliberately habit-neutral: nothing sent here may
 * reveal WHICH habit someone is quitting (see the privacy rule in CLAUDE.md).
 */
type Events = {
  onboarding_complete: { habit_count: number };
  habit_added: { habit_count: number };
  habit_removed: { habit_count: number };
  streak_started: undefined;
  slip_logged: undefined;
  urge_exercise_done: undefined;
  milestone_reached: { days: number };
  streak_shared: undefined;
  backup_enabled: undefined;
  backup_restored: undefined;
  account_deleted: undefined;
  focus_started: { minutes: number };
  focus_completed: { minutes: number };
};

export function track<E extends keyof Events>(name: E, ...params: Events[E] extends undefined ? [] : [Events[E]]) {
  try {
    logEvent(getAnalytics(), name, params[0]);
  } catch (e) {
    reportError(e, `track ${name}`);
  }
}

/**
 * Screens shared by every habit. Reel screens (ReelStats, Pause…) would reveal the habit and
 * Paywall would be purchase analytics, so any screen not listed here is never logged.
 */
const NEUTRAL_SCREENS = new Set(['Onboarding', 'Home', 'Focus', 'Milestones', 'Settings', 'Urge', 'Celebrate', 'AddHabit', 'Share']);

/** Route names only (Home, Milestones, Urge…), never habit names. */
export function trackScreen(name: string) {
  if (!NEUTRAL_SCREENS.has(name)) return;
  try {
    logEvent(getAnalytics(), 'screen_view', { screen_name: name, screen_class: name });
  } catch (e) {
    reportError(e, 'trackScreen');
  }
}

/** Sends a non-fatal error to Crashlytics (release builds only, see firebase.json). */
export function reportError(e: unknown, context?: string) {
  const error = e instanceof Error ? e : new Error(String(e));
  if (__DEV__) console.warn(context ?? 'error', error);
  try {
    const crashlytics = getCrashlytics();
    if (context) log(crashlytics, context);
    recordError(crashlytics, error);
  } catch {
    // Reporting must never crash the app.
  }
}
