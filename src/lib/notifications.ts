import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';
import i18n, { milestoneLabel } from '../i18n';
import { ACTIVE_HABIT } from '../habits';
import { readCheckin, readMilestoneAlerts, readState } from './storage';
import { DAY_MS } from './streak';

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
  queue = queue.then(rebuild).catch((e) => console.warn('syncNotifications failed', e));
  return queue;
}

async function rebuild() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!(await hasPermission())) return;

  const { streakStart } = readState();
  if (streakStart === null) return;
  const t = i18n.getFixedT(i18n.language);

  if (readMilestoneAlerts()) {
    for (const m of ACTIVE_HABIT.milestones) {
      const at = friendlyTime(streakStart + m * DAY_MS);
      if (at.getTime() <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `milestone-${m}`,
        content: {
          title: t('notifications.milestoneTitle', { label: milestoneLabel(m, t) }),
          body: t('notifications.milestoneBody'),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
      });
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
