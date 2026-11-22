import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import i18n, { milestoneLabel } from '../i18n';
import { HABITS, isHabitId } from '../habits';
import { focusEnd, readSession } from './focus';
import { isReelCounterOn } from './reels';
import { readCheckin, readMilestoneAlerts, readState, readTracked, writeActive } from './storage';
import { DAY_MS } from './streak';
import { reportError } from './telemetry';

const CHANNEL = 'reminders';

// Show notifications that arrive while the app is open, too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Android 13+ only shows the permission prompt once a channel exists, so create it at startup. */
export async function setupNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: i18n.t('notifications.channel'),
      importance: AndroidImportance.DEFAULT,
    });
  }
}

export async function hasPermission() {
  const p = await Notifications.getPermissionsAsync();
  return p.granted || p.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}

/**
 * Whether scheduled alerts arrive on time. Android 14+ denies exact alarms by default; without them
 * a 25-minute focus session's end alert can come many minutes late.
 */
export async function exactAlarmsAllowed() {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return true; // can't tell: don't nag
  }
}

/** Opens Android's "Alarms & reminders" setting, then reschedules with whatever the user chose. */
export async function allowExactAlarms() {
  try {
    await Notifications.requestExactAlarmPermissionsAsync();
  } catch (e) {
    reportError(e, 'exact alarms');
  }
  await syncNotifications();
}

/** Returns whether notifications are allowed. Asks only if the OS still lets us. */
export async function requestPermission() {
  if (await hasPermission()) return true;
  const p = await Notifications.requestPermissionsAsync();
  return p.granted;
}

/**
 * Milestone alerts land at a friendly hour instead of the exact anniversary minute:
 * never before 9:00, and anything after 21:00 moves to 9:00 the next morning.
 */
function friendlyTime(ms: number) {
  const d = new Date(ms);
  if (d.getHours() < 9) d.setHours(9, 0, 0, 0);
  else if (d.getHours() >= 21) {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  }
  return d;
}

/**
 * Rebuilds every scheduled notification from current state. Call after anything that
 * affects them (streak start/slip, language, settings). Calls are queued so they never interleave.
 *
 * Copy is deliberately neutral (no habit words) because notifications show on the lock screen.
 */
let queue = Promise.resolve();
export function syncNotifications() {
  queue = queue.then(rebuild).catch((e) => reportError(e, 'syncNotifications'));
  return queue;
}

async function rebuild() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!(await hasPermission())) return;

  const t = i18n.getFixedT(i18n.language);

  // Weekly reels summary (Sunday evening), neutral text; opens the history screen.
  if (isReelCounterOn() && readTracked().some((id) => HABITS[id].reelApps)) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'weekly-summary',
      content: {
        title: t('notifications.weeklyTitle'),
        body: t('notifications.weeklyBody'),
        data: { url: 'quitengine://reels' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // Sunday
        hour: 19,
        minute: 0,
        channelId: CHANNEL,
      },
    });
  }

  // End of a running focus session; opens the Focus tab.
  const focus = readSession();
  if (focus && focusEnd(focus) > Date.now()) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'focus-done',
      content: {
        title: t('notifications.focusTitle'),
        body: t('notifications.focusBody'),
        data: { url: 'quitengine://focus' },
      },
      // alarmClock: Android never defers it (with exact-alarm permission); a timer should ring on time.
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(focusEnd(focus)),
        channelId: CHANNEL,
        delivery: 'alarmClock',
      },
    });
  }

  const started = readTracked()
    .map((id) => ({ id, start: readState(id).streakStart }))
    .filter((h): h is { id: typeof h.id; start: number } => h.start !== null);
  if (!started.length) return;

  if (readMilestoneAlerts()) {
    for (const { id, start } of started) {
      for (const m of HABITS[id].milestones) {
        const at = friendlyTime(start + m * DAY_MS);
        if (at.getTime() <= Date.now()) continue;
        await Notifications.scheduleNotificationAsync({
          identifier: `milestone-${id}-${m}`,
          content: {
            title: t('notifications.milestoneTitle', { label: milestoneLabel(m, t) }),
            body: t('notifications.milestoneBody'),
            data: { habitId: id }, // tapping opens this habit
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
        });
      }
    }
  }

  const checkin = readCheckin();
  if (checkin.enabled) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'checkin',
      content: { title: t('notifications.checkinTitle'), body: t('notifications.checkinBody') },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: checkin.hour,
        minute: checkin.minute,
        channelId: CHANNEL,
      },
    });
  }
}

// Re-word scheduled notifications whenever the language changes.
i18n.on('languageChanged', () => void syncNotifications());

/** Tapping a milestone notification switches the app to that habit (also when it cold-starts the app). */
export function routeNotificationTaps() {
  const open = (response: Notifications.NotificationResponse | null) => {
    const data = response?.notification.request.content.data;
    const id = data?.habitId;
    if (isHabitId(id) && readTracked().includes(id)) writeActive(id);
    if (typeof data?.url === 'string' && data.url.startsWith('quitengine://')) void Linking.openURL(data.url);
  };
  Notifications.addNotificationResponseReceivedListener(open);
  void Notifications.getLastNotificationResponseAsync().then((r) => {
    open(r);
    // Forget it, so later launches don't jump back to this habit.
    if (r) void Notifications.clearLastNotificationResponseAsync();
  });
}
