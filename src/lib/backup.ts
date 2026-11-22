import { useEffect, useState } from 'react';
import { getApp } from '@react-native-firebase/app';
import {
  deleteUser,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithCredential,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';
import type { User } from '@react-native-firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  writeBatch,
} from '@react-native-firebase/firestore';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { useMMKVNumber } from 'react-native-mmkv';
import { isHabitId } from '../habits';
import { HabitId } from '../habits/types';
import { syncNotifications } from './notifications';
import { readActive, readState, readTracked, storage, writeActive, writeState, writeTracked } from './storage';
import { reportError, track } from './telemetry';

/**
 * Opt-in cloud backup: Google sign-in + Firestore (Enterprise DB "backup", asia-south1).
 * Data model and access rules: see firestore.rules. Slip timestamps are never uploaded.
 */

// OAuth "web" client (client_type 3 in google-services.json). Public identifier, not a secret.
const WEB_CLIENT_ID = '21020594529-mqej8pfth3jkfb7l41j9h9bu5v327mb3.apps.googleusercontent.com';
const DATABASE_ID = 'backup';
const LAST_BACKUP_KEY = 'backup.lastAt';

GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });

const db = () => getFirestore(getApp(), DATABASE_ID);
const userDoc = (uid: string) => doc(db(), 'users', uid);
const habitsCol = (uid: string) => collection(db(), 'users', uid, 'habits');

/** The signed-in user, or null. Re-renders on sign-in/out. */
export function useAuthUser(): User | null {
  const [user, setUser] = useState<User | null>(() => getAuth().currentUser);
  useEffect(() => onAuthStateChanged(getAuth(), setUser), []);
  return user;
}

/** Epoch ms of the last successful backup on this phone, if any. */
export function useLastBackupAt(): number | undefined {
  const [value] = useMMKVNumber(LAST_BACKUP_KEY, storage);
  return value;
}

async function googleCredential() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null; // user cancelled
  const { idToken } = response.data;
  if (!idToken) throw new Error('Google sign-in returned no idToken');
  return GoogleAuthProvider.credential(idToken);
}

/** Shows the Google account picker and signs in to Firebase. Returns false if the user cancelled. */
export async function signInWithGoogle(): Promise<boolean> {
  const credential = await googleCredential();
  if (!credential) return false;
  await signInWithCredential(getAuth(), credential);
  track('backup_enabled');
  return true;
}

export async function signOut() {
  await firebaseSignOut(getAuth());
  await GoogleSignin.signOut();
  storage.remove(LAST_BACKUP_KEY);
}

/** Uploads tracked habits (no slip history). No-op when signed out. */
export async function backupNow() {
  const uid = getAuth().currentUser?.uid;
  const tracked = readTracked();
  if (!uid || !tracked.length) return;

  const batch = writeBatch(db());
  batch.set(userDoc(uid), {
    version: 1,
    tracked,
    active: readActive() ?? tracked[0],
    updatedAt: serverTimestamp(),
  });
  for (const id of tracked) {
    const s = readState(id);
    batch.set(doc(habitsCol(uid), id), {
      quizAnswers: s.quizAnswers,
      streakStart: s.streakStart,
      urgesResisted: s.urgesResisted,
      bestStreakDays: s.bestStreakDays,
      pastDaysFree: s.pastDaysFree,
      celebrated: s.celebrated,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  storage.set(LAST_BACKUP_KEY, Date.now());
}

/** Backs up quietly (e.g. when the app goes to the background); failures are only reported. */
export function backupInBackground() {
  if (!getAuth().currentUser) return;
  backupNow().catch((e) => reportError(e, 'background backup'));
}

export interface CloudBackup {
  updatedAt: number; // epoch ms
  tracked: HabitId[];
  active: HabitId;
  habits: Partial<Record<HabitId, Record<string, unknown>>>;
}

/** The signed-in user's backup, or null if they have none. */
export async function readCloudBackup(): Promise<CloudBackup | null> {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return null;
  const root = await getDoc(userDoc(uid));
  if (!root.exists()) return null;
  const data = root.data() ?? {};
  const tracked = (Array.isArray(data.tracked) ? data.tracked : []).filter(isHabitId);
  if (!tracked.length) return null;

  const habits: CloudBackup['habits'] = {};
  (await getDocs(habitsCol(uid))).forEach((d) => {
    if (isHabitId(d.id)) habits[d.id] = d.data();
  });
  return {
    updatedAt: data.updatedAt?.toMillis?.() ?? 0,
    tracked,
    active: isHabitId(data.active) && tracked.includes(data.active) ? data.active : tracked[0],
    habits,
  };
}

const asInt = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);

/** Replaces this phone's progress with the backup. */
export function restoreBackup(backup: CloudBackup) {
  for (const id of backup.tracked) {
    const h = backup.habits[id];
    if (!h) continue;
    writeState(id, {
      quizAnswers: (h.quizAnswers as Record<string, number>) ?? {},
      streakStart: typeof h.streakStart === 'number' ? h.streakStart : null,
      relapses: [], // never backed up
      urgesResisted: asInt(h.urgesResisted),
      bestStreakDays: asInt(h.bestStreakDays),
      pastDaysFree: asInt(h.pastDaysFree),
      celebrated: asInt(h.celebrated),
    });
  }
  writeTracked(backup.tracked);
  writeActive(backup.active);
  storage.set(LAST_BACKUP_KEY, backup.updatedAt || Date.now());
  track('backup_restored');
  void syncNotifications();
}

/**
 * Deletes the cloud backup and the Firebase account (required by Google Play for apps with
 * accounts). Progress on this phone is kept. May show the Google picker again if the
 * sign-in is too old for Firebase to allow deletion.
 */
export async function deleteBackupAndAccount() {
  const user = getAuth().currentUser;
  if (!user) return;

  const batch = writeBatch(db());
  (await getDocs(habitsCol(user.uid))).forEach((d) => batch.delete(d.ref));
  batch.delete(userDoc(user.uid));
  await batch.commit();

  try {
    await deleteUser(user);
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/requires-recent-login') throw e;
    const credential = await googleCredential();
    if (!credential) return;
    await reauthenticateWithCredential(user, credential);
    await deleteUser(user);
  }
  await GoogleSignin.revokeAccess().catch(() => undefined);
  await GoogleSignin.signOut();
  storage.remove(LAST_BACKUP_KEY);
  track('account_deleted');
}
