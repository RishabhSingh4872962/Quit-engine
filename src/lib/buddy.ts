import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useMMKVBoolean, useMMKVString } from 'react-native-mmkv';
import { getAuth } from '@react-native-firebase/auth';
import { get, onValue, push, ref, serverTimestamp, set, update } from '@react-native-firebase/database';
import { isBlockedText } from '../rooms/data';
import { earnReels } from './earn';
import { readTodayMinutes } from './focus';
import { checkInDay, readDays } from './journal';
import { localDay } from './reels';
import i18n from '../i18n';
import { forgetBuddyPushToken, notifyBuddy, saveBuddyPushToken } from './push';
import { db, roomsUid, useRoomsUid } from './rooms';
import { readActive, readState, readTracked, storage } from './storage';
import { streakDays } from './streak';
import { reportError } from './telemetry';

/**
 * Accountability buddy: one person, paired with a one-time code (24 h). Each sees the other's summary
 * (a name, days on track, focus minutes today, today's check-in) and can say yes when the other asks
 * for "5 more" at their daily limit. Asks and answers also send a push notification when the push
 * Worker is set up (src/lib/push.ts). Nothing here names or hints at a habit; rules and tests:
 * database.rules.json (pairs, buddy, bstatus, breq, push) and scripts/test-db-rules.mjs.
 */

export interface BuddyStatus {
  name: string;
  streak: number; // days on track (the shortest current streak)
  focus: number; // focus minutes today
  kept?: boolean; // today's check-in: kept the promise?
  day: string;
  at: number;
}

export interface BuddyAsk {
  id: string;
  from: string;
  n: number;
  at: number;
  state: 'wait' | 'yes' | 'no';
}

export type Buddy =
  | { kind: 'none' }
  | { kind: 'loading'; code: string }
  | { kind: 'waiting'; code: string }
  | { kind: 'paired'; code: string; uid: string; status: BuddyStatus | null; asks: BuddyAsk[] };

export const ASK_REELS = 5;
const CODE_KEY = 'buddy.code';
const LINKED_KEY = 'buddy.linked'; // code whose buddy record I've written
const NAME_KEY = 'buddy.name';
const SHARE_KEY = 'buddy.share';
const ASK_KEY = 'buddy.ask'; // my open request's id
const ANSWER_KEY = 'buddy.answer'; // 'yes:<n>' | 'no', shown once on the pause screen
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const readBuddyCode = () => storage.getString(CODE_KEY);
export const readBuddyName = () => storage.getString(NAME_KEY) ?? '';
export const writeBuddyName = (name: string) => storage.set(NAME_KEY, name.trim());
export const readShare = () => storage.getBoolean(SHARE_KEY) ?? true;
export const useBuddyName = () => useMMKVString(NAME_KEY, storage)[0] ?? '';
export const useShare = () => useMMKVBoolean(SHARE_KEY, storage)[0] ?? true;
export const useMyAsk = () => useMMKVString(ASK_KEY, storage)[0];
export const useAskAnswer = () => useMMKVString(ANSWER_KEY, storage)[0];
export const clearAskAnswer = () => storage.remove(ANSWER_KEY);

/** 1–20 characters, any script (Hindi names too), no markup, no blocked words. */
export const validBuddyName = (name: string) => {
  const n = name.trim();
  return n.length >= 1 && n.length <= 20 && !/[<>]/.test(n) && !isBlockedText(n);
};

const newCode = () => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

/** Creates a one-time pairing code (tries again on the rare clash with an existing one). */
export async function createPairCode(): Promise<string> {
  const uid = await roomsUid();
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    try {
      await set(ref(db(), `pairs/${code}`), { a: uid, at: serverTimestamp() });
      storage.set(CODE_KEY, code);
      return code;
    } catch {
      // taken: try another
    }
  }
  throw new Error('no free pairing code');
}

export type JoinResult = 'ok' | 'notFound' | 'used' | 'own';

/** Joins the buddy who shared this code. */
export async function joinPair(raw: string): Promise<JoinResult> {
  const code = raw.trim().toUpperCase();
  const uid = await roomsUid();
  const pair = (await get(ref(db(), `pairs/${code}`))).val() as { a?: string; b?: string; at?: number } | null;
  if (!pair?.a || !pair.at || pair.at < Date.now() - 86_400_000) return 'notFound';
  if (pair.a === uid) return 'own';
  if (pair.b) return 'used';
  await update(ref(db(), `pairs/${code}`), { b: uid });
  await set(ref(db(), `buddy/${uid}`), { with: pair.a, code, at: serverTimestamp() });
  storage.set(CODE_KEY, code);
  storage.set(LINKED_KEY, code);
  void publishBuddyStatus();
  void syncBuddyPush();
  return 'ok';
}

/** Ends the pairing (also used when the buddy already ended it). Deletes what I put there. */
export async function endPairing() {
  const code = readBuddyCode();
  const uid = getAuth().currentUser?.uid;
  if (code && uid) {
    const mine = { [`bstatus/${uid}`]: null, [`buddy/${uid}`]: null, [`push/${uid}`]: null };
    try {
      await update(ref(db()), { ...mine, [`breq/${code}`]: null, [`pairs/${code}`]: null });
    } catch {
      await update(ref(db()), mine).catch((e: unknown) => reportError(e, 'end pairing'));
    }
  }
  for (const key of [CODE_KEY, LINKED_KEY, ASK_KEY, ANSWER_KEY]) storage.remove(key);
  forgetBuddyPushToken();
}

/** While paired, keeps this phone's push token (and language) where only my buddy can read it. */
export function syncBuddyPush() {
  const code = readBuddyCode();
  const uid = getAuth().currentUser?.uid;
  if (!code || !uid || storage.getString(LINKED_KEY) !== code) return;
  return saveBuddyPushToken(uid);
}

/** Days on track (the shortest current streak), focus today and today's check-in, if I share them. */
export async function publishBuddyStatus() {
  const code = readBuddyCode();
  const uid = getAuth().currentUser?.uid;
  if (!code || !uid || storage.getString(LINKED_KEY) !== code) return;
  try {
    if (!readShare() || !validBuddyName(readBuddyName())) return void (await set(ref(db(), `bstatus/${uid}`), null));
    const now = Date.now();
    const starts = readTracked().map((id) => readState(id).streakStart).filter((s): s is number => s !== null);
    const active = readActive();
    const kept = active ? readDays(active)[checkInDay(now)]?.kept : undefined;
    await set(ref(db(), `bstatus/${uid}`), {
      name: readBuddyName(),
      streak: starts.length ? Math.min(...starts.map((s) => streakDays(s, now))) : 0,
      focus: Math.min(1440, readTodayMinutes(now)),
      ...(kept !== undefined ? { kept } : {}),
      day: localDay(now),
      at: serverTimestamp(),
    });
  } catch (e) {
    reportError(e, 'buddy status');
  }
}

export function setShare(on: boolean) {
  storage.set(SHARE_KEY, on);
  void publishBuddyStatus();
}

/** "Ask my buddy for 5 more" (pause screen). The answer arrives through useBuddySync. */
export async function askBuddy() {
  const code = readBuddyCode();
  const uid = await roomsUid();
  if (!code) return;
  const item = push(ref(db(), `breq/${code}`));
  await set(item, { from: uid, n: ASK_REELS, at: serverTimestamp(), state: 'wait' });
  if (item.key) storage.set(ASK_KEY, item.key);
  storage.remove(ANSWER_KEY);
  if (item.key) void notifyBuddy('ask', item.key);
}

/** My buddy's answer to someone's request. */
export function answerAsk(id: string, yes: boolean) {
  const code = readBuddyCode();
  if (!code) return;
  update(ref(db(), `breq/${code}/${id}`), { state: yes ? 'yes' : 'no' })
    .then(() => notifyBuddy('answer', id))
    .catch((e: unknown) => reportError(e, 'answer ask'));
}

/** My open request was answered: a yes adds the reels to today's limit (like earned ones). */
function applyAnswer(code: string, id: string, ask: { state?: string; n?: number } | null) {
  if (!ask || ask.state === 'wait') return;
  storage.remove(ASK_KEY);
  if (ask.state === 'yes') {
    const added = earnReels(Math.min(10, ask.n ?? ASK_REELS));
    storage.set(ANSWER_KEY, `yes:${added}`);
  } else {
    storage.set(ANSWER_KEY, 'no');
  }
  void update(ref(db()), { [`breq/${code}/${id}`]: null }).catch(() => undefined);
}

/**
 * The pairing as seen from this phone: waiting for the buddy to enter the code, or paired (their
 * summary and their open requests). Also links my side once they joined, and cleans up if they ended it.
 */
export function useBuddy(): Buddy {
  const [code] = useMMKVString(CODE_KEY, storage);
  const uid = useRoomsUid();
  const [pair, setPair] = useState<{ code: string; a?: string; b?: string } | null | undefined>(undefined);
  const [status, setStatus] = useState<{ uid: string; value: BuddyStatus | null } | null>(null);
  const [asks, setAsks] = useState<{ code: string; list: BuddyAsk[] } | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!code || !uid) return;
    return onValue(
      ref(db(), `pairs/${code}`),
      (snap) => {
        const v = snap.val() as { a?: string; b?: string } | null;
        if (!v) return void endPairing(); // the buddy ended it (or the code expired unused)
        setPair({ code, ...v });
      },
      (e) => reportError(e, 'buddy pair'),
    );
  }, [code, uid]);

  const other = pair && uid && pair.code === code ? (pair.a === uid ? pair.b : pair.a) : undefined;

  // Once they joined, record them as my buddy (that lets them read my summary), then share it.
  useEffect(() => {
    if (!other || !code || !uid || storage.getString(LINKED_KEY) === code) return;
    set(ref(db(), `buddy/${uid}`), { with: other, code, at: serverTimestamp() })
      .then(() => {
        storage.set(LINKED_KEY, code);
        void publishBuddyStatus();
        void syncBuddyPush();
      })
      .catch((e: unknown) => reportError(e, 'buddy link'));
  }, [other, code, uid]);

  // Their summary is readable once they've linked their side; until then, try again now and then.
  useEffect(() => {
    if (!other) return;
    return onValue(
      ref(db(), `bstatus/${other}`),
      (snap) => setStatus({ uid: other, value: (snap.val() as BuddyStatus | null) ?? null }),
      () => {
        setStatus({ uid: other, value: null });
        setTimeout(() => setRetry((r) => r + 1), 30_000);
      },
    );
  }, [other, retry]);

  useEffect(() => {
    if (!other || !code) return;
    return onValue(
      ref(db(), `breq/${code}`),
      (snap) => {
        const list: BuddyAsk[] = [];
        snap.forEach((child) => {
          const v = child.val() as Omit<BuddyAsk, 'id'>;
          if (child.key && v.from === other) list.push({ ...v, id: child.key });
          return undefined;
        });
        setAsks({ code, list });
      },
      (e) => reportError(e, 'buddy asks'),
    );
  }, [other, code]);

  if (!code) return { kind: 'none' };
  if (pair === undefined || pair?.code !== code) return { kind: 'loading', code };
  if (!other) return { kind: 'waiting', code };
  return {
    kind: 'paired',
    code,
    uid: other,
    status: status?.uid === other ? status.value : null,
    asks: asks?.code === code ? asks.list.filter((a) => a.state === 'wait') : [],
  };
}

/**
 * App-wide: shares my summary and keeps my push token current when the app comes to the front (or the
 * token or language changes), and applies the answer to my open request (while the app is open;
 * otherwise the next time it opens).
 */
export function useBuddySync() {
  const [code] = useMMKVString(CODE_KEY, storage);
  const [askId] = useMMKVString(ASK_KEY, storage);
  useEffect(() => {
    if (!code) return;
    const refresh = () => {
      void publishBuddyStatus();
      void syncBuddyPush();
    };
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const tokenSub = Notifications.addPushTokenListener(() => {
      forgetBuddyPushToken();
      void syncBuddyPush();
    });
    const onLang = () => void syncBuddyPush();
    i18n.on('languageChanged', onLang);
    return () => {
      sub.remove();
      tokenSub.remove();
      i18n.off('languageChanged', onLang);
    };
  }, [code]);
  useEffect(() => {
    if (!code || !askId) return;
    return onValue(
      ref(db(), `breq/${code}/${askId}`),
      (snap) => applyAnswer(code, askId, snap.val() as { state?: string; n?: number } | null),
      (e) => reportError(e, 'buddy answer'),
    );
  }, [code, askId]);
}
