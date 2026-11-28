import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import { ref, serverTimestamp, set } from '@react-native-firebase/database';
import i18n from '../i18n';
import { hasPermission } from './notifications';
import { db } from './rooms';
import { storage } from './storage';
import { reportError } from './telemetry';

/**
 * Buddy push notifications. While paired, this phone's FCM token (and app language) sits at push/<uid>,
 * readable only by the buddy (database.rules.json). After an ask or an answer, the app asks the
 * buddy-push Worker (workers/buddy-push) to notify the other phone; the Worker checks the request and
 * sends neutral text (never a habit). Without EXPO_PUBLIC_PUSH_URL nothing is stored or sent, and
 * buddies see requests when they open the app, as before.
 */

const PUSH_URL = process.env.EXPO_PUBLIC_PUSH_URL;
export const buddyPushAvailable = Platform.OS === 'android' && Boolean(PUSH_URL);
const SAVED_KEY = 'buddy.pushSaved'; // `${uid}|${token}|${lang}` last written, to skip repeat writes

/** Saves this phone's push token for my buddy's notifications (only with notification permission). */
export async function saveBuddyPushToken(uid: string) {
  if (!buddyPushAvailable || !(await hasPermission())) return;
  try {
    const token = String((await Notifications.getDevicePushTokenAsync()).data);
    const lang = i18n.language === 'hi' ? 'hi' : 'en';
    const saved = `${uid}|${token}|${lang}`;
    if (storage.getString(SAVED_KEY) === saved) return;
    await set(ref(db(), `push/${uid}`), { t: token, lang, at: serverTimestamp() });
    storage.set(SAVED_KEY, saved);
  } catch (e) {
    reportError(e, 'buddy push token');
  }
}

/** Forget what was saved (the database entry itself is deleted with the pairing). */
export const forgetBuddyPushToken = () => storage.remove(SAVED_KEY);

/** Asks the Worker to tell my buddy about request `id`. Best effort: the app works the same without it. */
export async function notifyBuddy(kind: 'ask' | 'answer', id: string) {
  const user = getAuth().currentUser;
  if (!buddyPushAvailable || !user) return;
  try {
    const res = await fetch(`${PUSH_URL}/push`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await user.getIdToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ kind, id }),
    });
    if (!res.ok && res.status !== 409 && res.status !== 429) reportError(new Error(`buddy push ${res.status}`), 'buddy push');
  } catch (e) {
    reportError(e, 'buddy push');
  }
}
