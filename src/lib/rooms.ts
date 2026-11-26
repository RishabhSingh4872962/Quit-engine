import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { deleteUser, getAuth, onAuthStateChanged, signInAnonymously } from '@react-native-firebase/auth';
import {
  DataSnapshot,
  get,
  getDatabase,
  goOffline,
  goOnline,
  increment,
  limitToLast,
  onDisconnect,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  serverTimestamp,
  set,
  update,
} from '@react-native-firebase/database';
import { useMMKVString } from 'react-native-mmkv';
import { FocusTag, isFocusTag, RoomKind, ROOM_KINDS } from '../rooms/data';
import { focusEnd, readSession, readTodayMinutes, sessionMode } from './focus';
import { localDay } from './reels';
import { storage } from './storage';
import { reportError } from './telemetry';

/**
 * Rooms: focusing together, by nickname. Realtime Database in asia-southeast1; access rules and their
 * tests are in database.rules.json and scripts/test-db-rules.mjs. Rooms use anonymous Firebase sign-in
 * (or the backup Google account if signed in), so no email or real name is attached to a room profile.
 * Nothing written here may name or hint at a habit: only nicknames, avatars, focus tags and minutes.
 */

const DB_URL = 'https://quit-engine-app-default-rtdb.asia-southeast1.firebasedatabase.app';
const db = () => getDatabase(getApp(), DB_URL);
/** All shared room timers count from midnight IST, 1 Jan 2026, so rounds start on the hour / half hour. */
const ANCHOR = 1767205800000;

export interface Room {
  id: string;
  name: string;
  hi?: string; // Hindi name (official rooms)
  kind: RoomKind;
  tag: FocusTag;
  focus: number; // minutes
  brk: number; // minutes; 0 = no shared timer
  quiet: boolean; // no feed or high fives
  strict: boolean;
  max: number;
  owner: string; // '' for official rooms
  slot: string;
  code?: string; // invite code (invite-only rooms)
  hidden: boolean; // invite-only
  order: number;
}

export interface Member {
  uid: string;
  nick: string;
  avatar: string;
  tag?: FocusTag;
  state: 'focus' | 'break' | 'idle';
  since: number;
  ends: number;
  conn: boolean;
  today: number;
}

export interface FeedItem {
  id: string;
  uid: string;
  nick: string;
  avatar: string;
  min: number;
  at: number;
  fives: string[]; // uids
}

export interface BoardRow {
  uid: string;
  nick: string;
  avatar: string;
  min: number;
}

export interface RoomProfile {
  nick: string;
  avatar: string;
  tag?: FocusTag;
  board: boolean; // shown on room leaderboards (opt-in)
}

type Raw = Record<string, unknown>;
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function toRoom(id: string, v: unknown, hidden: boolean): Room | null {
  const o = v as Raw | null;
  if (!o || typeof o.name !== 'string') return null;
  const kind = ROOM_KINDS.includes(o.kind as RoomKind) ? (o.kind as RoomKind) : 'custom';
  return {
    id,
    name: o.name,
    hi: typeof o.hi === 'string' ? o.hi : undefined,
    kind,
    tag: isFocusTag(o.tag) ? o.tag : 'other',
    focus: num(o.focus, 25),
    brk: num(o.brk),
    quiet: o.quiet === true,
    strict: o.strict === true,
    max: num(o.max, 50),
    owner: str(o.owner),
    slot: str(o.slot),
    code: typeof o.code === 'string' ? o.code : undefined,
    hidden,
    order: num(o.order, 99),
  };
}

function toProfile(v: unknown): RoomProfile | null {
  const o = v as Raw | null;
  if (!o || typeof o.nick !== 'string') return null;
  return { nick: o.nick, avatar: str(o.avatar, 'a01'), tag: isFocusTag(o.tag) ? o.tag : undefined, board: o.board === true };
}

const children = (snap: DataSnapshot) => {
  const out: { key: string; val: unknown }[] = [];
  snap.forEach((c) => {
    if (c.key) out.push({ key: c.key, val: c.val() });
    return undefined;
  });
  return out;
};

// ---------- Shared timer ----------

export interface RoomPhase {
  phase: 'focus' | 'break';
  left: number; // ms
  total: number; // ms of this phase
  ends: number; // epoch ms
}

/** Where the room's shared focus/break cycle is now, or null for rooms without one. */
export function roomPhase(room: Pick<Room, 'focus' | 'brk'>, now: number): RoomPhase | null {
  if (!room.brk) return null;
  const focusMs = room.focus * 60_000;
  const period = focusMs + room.brk * 60_000;
  const pos = (((now - ANCHOR) % period) + period) % period;
  return pos < focusMs
    ? { phase: 'focus', left: focusMs - pos, total: focusMs, ends: now + focusMs - pos }
    : { phase: 'break', left: period - pos, total: period - focusMs, ends: now + period - pos };
}

/**
 * A focus session started in this room: the rest of the current round if it's worth joining (ending
 * exactly with the round), otherwise a full round of your own.
 */
export function roomSession(room: Pick<Room, 'focus' | 'brk'>, now: number, fallback: number): { minutes: number; endsAt?: number } {
  const p = roomPhase(room, now);
  if (!p) return { minutes: fallback };
  if (p.phase === 'focus' && p.left >= 5 * 60_000) return { minutes: Math.ceil(p.left / 60_000), endsAt: p.ends };
  return { minutes: room.focus };
}

// ---------- Identity ----------

/** The user id for rooms, signing in anonymously the first time. */
export async function roomsUid(): Promise<string> {
  const auth = getAuth();
  if (auth.currentUser) return auth.currentUser.uid;
  return (await signInAnonymously(auth)).user.uid;
}

export function useRoomsUid(): string | null {
  const [uid, setUid] = useState(() => getAuth().currentUser?.uid ?? null);
  useEffect(() => onAuthStateChanged(getAuth(), (u) => setUid(u?.uid ?? null)), []);
  return uid;
}

/** Subscribes to one database path while `path` is set; undefined while loading. */
function useDbValue(path: string | null): { path: string; value: unknown } | undefined {
  const [state, setState] = useState<{ path: string; value: unknown } | null>(null);
  useEffect(() => {
    if (!path) return;
    return onValue(
      ref(db(), path),
      (snap) => setState({ path, value: snap.val() }),
      (e) => reportError(e, `rooms read ${path.split('/')[0]}`),
    );
  }, [path]);
  return state && state.path === path ? state : undefined; // same object until the data changes
}

/** My room profile: undefined while loading, null if I don't have one yet. */
export function useRoomProfile(uid: string | null): RoomProfile | null | undefined {
  const res = useDbValue(uid ? `profiles/${uid}` : null);
  return useMemo(() => (uid ? (res ? toProfile(res.value) : undefined) : null), [uid, res]);
}

export async function isNickFree(nick: string, uid: string | null) {
  const owner = (await get(ref(db(), `nicks/${nick.toLowerCase()}`))).val();
  return owner === null || owner === uid;
}

/** Saves the profile; claims the nickname (and releases the old one) in the same write. */
export async function saveRoomProfile(p: RoomProfile, previousNick?: string) {
  const uid = await roomsUid();
  const updates: Record<string, unknown> = {
    [`nicks/${p.nick.toLowerCase()}`]: uid,
    [`profiles/${uid}`]: { nick: p.nick, avatar: p.avatar, board: p.board, at: serverTimestamp(), ...(p.tag ? { tag: p.tag } : {}) },
  };
  if (previousNick && previousNick.toLowerCase() !== p.nick.toLowerCase()) updates[`nicks/${previousNick.toLowerCase()}`] = null;
  await update(ref(db()), updates);
  // Leaving leaderboards removes me from them.
  if (!p.board) await clearFootprint('board/');
  if (readCurrentRoom()) void writePresence(false);
}

// ---------- Rooms ----------

export function useRooms(active: boolean): Room[] | undefined {
  const res = useDbValue(active ? 'rooms' : null);
  return useMemo(() => {
    if (!res) return undefined;
    const all = Object.entries((res.value as Raw | null) ?? {}).map(([id, v]) => toRoom(id, v, false));
    return all.filter((r): r is Room => r !== null);
  }, [res]);
}

/**
 * People connected per room: each person keeps one marker `here/<room>/<uid>` that the server removes
 * when they disconnect, so the number can't drift (focusing people who went offline aren't counted).
 */
export function useRoomCounts(active: boolean): Record<string, number> {
  const res = useDbValue(active ? 'here' : null);
  return useMemo(() => {
    const out: Record<string, number> = {};
    for (const [room, people] of Object.entries((res?.value as Raw | null) ?? {})) {
      out[room] = Object.keys((people as Raw | null) ?? {}).length;
    }
    return out;
  }, [res]);
}

export function useRoom(id: string, hidden: boolean): Room | null | undefined {
  const res = useDbValue(`${hidden ? 'hidden' : 'rooms'}/${id}`);
  return useMemo(() => (res ? toRoom(id, res.value, hidden) : undefined), [id, hidden, res]);
}

/** Rooms I created (slots s1–s3). */
export function useMyRoomIds(uid: string | null): string[] {
  const res = useDbValue(uid ? `owned/${uid}` : null);
  return useMemo(() => Object.values((res?.value as Record<string, string> | null) ?? {}), [res]);
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export interface NewRoom {
  name: string;
  tag: FocusTag;
  focus: number;
  brk: number;
  quiet: boolean;
  invite: boolean;
}

/** Creates a custom room (at most 3 per person). Returns its id and invite code, or 'limit'. */
export async function createRoom(r: NewRoom): Promise<{ id: string; code?: string } | 'limit'> {
  const uid = await roomsUid();
  const owned = ((await get(ref(db(), `owned/${uid}`))).val() as Record<string, string> | null) ?? {};
  const slot = ['s1', 's2', 's3'].find((s) => !owned[s]);
  if (!slot) return 'limit';
  const base = r.invite ? 'hidden' : 'rooms';
  const id = push(ref(db(), base)).key;
  if (!id) throw new Error('no room id');
  let code: string | undefined;
  if (r.invite) {
    for (let i = 0; i < 5 && !code; i++) {
      const c = newCode();
      if (!(await get(ref(db(), `codes/${c}`))).exists()) code = c;
    }
    if (!code) throw new Error('no free invite code');
  }
  const room = {
    name: r.name.trim(), kind: 'custom', tag: r.tag, focus: r.focus, brk: r.brk, quiet: r.quiet, strict: r.quiet,
    max: 50, owner: uid, slot, at: serverTimestamp(), ...(code ? { code } : {}),
  };
  await update(ref(db()), {
    [`${base}/${id}`]: room,
    [`owned/${uid}/${slot}`]: id,
    ...(code ? { [`codes/${code}`]: id } : {}),
  });
  if (code) saveInviteRoom(id);
  return { id, code };
}

export async function deleteRoom(room: Room) {
  const uid = await roomsUid();
  if (room.owner !== uid) return;
  if (readCurrentRoom()?.id === room.id) await leaveRoom();
  await update(ref(db()), {
    [`${room.hidden ? 'hidden' : 'rooms'}/${room.id}`]: null,
    ...(room.slot ? { [`owned/${uid}/${room.slot}`]: null } : {}),
    ...(room.code ? { [`codes/${room.code}`]: null } : {}),
  });
}

/** Finds an invite-only room by its 6-character code. */
export async function findRoomByCode(code: string): Promise<string | null> {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(c)) return null;
  await roomsUid();
  const id = (await get(ref(db(), `codes/${c}`))).val();
  if (typeof id !== 'string') return null;
  saveInviteRoom(id);
  return id;
}

// Invite-only rooms aren't listed anywhere, so the phone remembers the ones you opened.
const INVITE_KEY = 'rooms.invites';
const parseIds = (raw: string | undefined): string[] => {
  try {
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
function saveInviteRoom(id: string) {
  const ids = parseIds(storage.getString(INVITE_KEY));
  if (!ids.includes(id)) storage.set(INVITE_KEY, JSON.stringify([id, ...ids].slice(0, 20)));
}
export function forgetInviteRoom(id: string) {
  storage.set(INVITE_KEY, JSON.stringify(parseIds(storage.getString(INVITE_KEY)).filter((x) => x !== id)));
}
export function useInviteRoomIds(): string[] {
  const [raw] = useMMKVString(INVITE_KEY, storage);
  return useMemo(() => parseIds(raw), [raw]);
}

// ---------- Being in a room (presence) ----------

const CURRENT_KEY = 'rooms.current';
interface CurrentRoom {
  id: string;
  hidden: boolean;
}
const parseCurrent = (raw: string | undefined): CurrentRoom | null => {
  try {
    const v = raw ? (JSON.parse(raw) as CurrentRoom) : null;
    return v && typeof v.id === 'string' ? { id: v.id, hidden: v.hidden === true } : null;
  } catch {
    return null;
  }
};
export const readCurrentRoom = () => parseCurrent(storage.getString(CURRENT_KEY));
export function useCurrentRoom(): CurrentRoom | null {
  const [raw] = useMMKVString(CURRENT_KEY, storage);
  return useMemo(() => parseCurrent(raw), [raw]);
}

let presence: { room: string; stop: () => void } | null = null;

/** My presence fields: what I'm doing right now (from the focus timer) and today's focus minutes. */
// A stopwatch has no planned end, so it's shown as "focusing · N min so far" (ends 0).
function presenceState() {
  const s = readSession();
  if (!s || focusEnd(s) <= Date.now()) return { state: 'idle', ends: 0 };
  return { state: 'focus', ends: sessionMode(s) === 'stopwatch' ? 0 : focusEnd(s), ...(s.tag ? { tag: s.tag } : {}) };
}

/** Writes my presence; `connected` (a fresh connection) also sets my "here" marker. */
async function writePresence(connected: boolean) {
  const cur = readCurrentRoom();
  const uid = getAuth().currentUser?.uid;
  if (!cur || !uid) return;
  try {
    const profile = toProfile((await get(ref(db(), `profiles/${uid}`))).val());
    if (!profile) return;
    const me = ref(db(), `online/${cur.id}/${uid}`);
    const here = ref(db(), `here/${cur.id}/${uid}`);
    await set(me, {
      nick: profile.nick,
      avatar: profile.avatar,
      ...(profile.tag ? { tag: profile.tag } : {}),
      ...presenceState(), // a session's tag replaces the profile's
      since: serverTimestamp(),
      away: false,
      conn: true,
      today: Math.min(1440, readTodayMinutes()),
    });
    // onDisconnect writes are checked against the rules when registered, so register them after the
    // data they change exists. If the connection drops (phone locked, no network), I stay listed
    // while a focus session runs.
    await onDisconnect(me).update({ conn: false });
    if (connected) {
      await set(here, true);
      await onDisconnect(here).remove();
    }
  } catch (e) {
    reportError(e, 'room presence');
  }
}

/** (Re)connects presence for the current room; on every reconnect it writes it again. */
export function resumeRoom() {
  const cur = readCurrentRoom();
  if (!cur || presence?.room === cur.id || !getAuth().currentUser) return;
  presence?.stop();
  const stop = onValue(ref(db(), '.info/connected'), (snap) => {
    if (snap.val() === true) void writePresence(true);
  });
  presence = { room: cur.id, stop };
  const uid = getAuth().currentUser?.uid;
  addFootprint(`online/${cur.id}/${uid}`);
  addFootprint(`here/${cur.id}/${uid}`);
}

export async function enterRoom(id: string, hidden: boolean) {
  await roomsUid();
  const cur = readCurrentRoom();
  if (cur && cur.id !== id) await leaveRoom();
  storage.set(CURRENT_KEY, JSON.stringify({ id, hidden }));
  resumeRoom();
}

export async function leaveRoom() {
  const cur = readCurrentRoom();
  storage.remove(CURRENT_KEY);
  presence?.stop();
  presence = null;
  const uid = getAuth().currentUser?.uid;
  if (!cur || !uid) return;
  try {
    const me = ref(db(), `online/${cur.id}/${uid}`);
    const here = ref(db(), `here/${cur.id}/${uid}`);
    await onDisconnect(me).cancel();
    await onDisconnect(here).cancel();
    await set(me, null);
    await set(here, null);
  } catch (e) {
    reportError(e, 'leave room');
  }
}

/** Mirrors the focus timer into the room (called by actions when a session starts or ends). */
export function syncRoomPresence() {
  const cur = readCurrentRoom();
  const uid = getAuth().currentUser?.uid;
  if (!cur || !uid) return;
  update(ref(db(), `online/${cur.id}/${uid}`), {
    ...presenceState(),
    since: serverTimestamp(),
    today: Math.min(1440, readTodayMinutes()),
  }).catch((e) => reportError(e, 'room presence update'));
}

// Only foreground phones keep a connection (the free plan allows 100 at once). People in a focus
// session stay listed anyway, until their session ends.
AppState.addEventListener('change', (s) => {
  try {
    if (s === 'background') goOffline(db());
    else if (s === 'active') goOnline(db());
  } catch (e) {
    reportError(e, 'rooms connection');
  }
});

/** People in a room: connected, or offline but still inside a focus session. */
export function useMembers(roomId: string, now: number): Member[] | undefined {
  const res = useDbValue(`online/${roomId}`);
  return useMemo(() => {
    if (!res) return undefined;
    const list: Member[] = [];
    for (const [uid, v] of Object.entries((res.value as Raw | null) ?? {})) {
      const o = v as Raw;
      if (!o || typeof o.nick !== 'string') continue;
      const m: Member = {
        uid,
        nick: o.nick,
        avatar: str(o.avatar, 'a01'),
        tag: isFocusTag(o.tag) ? o.tag : undefined,
        state: o.state === 'focus' || o.state === 'break' ? o.state : 'idle',
        since: num(o.since),
        ends: num(o.ends),
        conn: o.conn !== false,
        today: num(o.today),
      };
      // Open-ended (stopwatch) sessions count while connected, or for up to 3 hours.
      const open = m.ends === 0 && (m.conn || now - m.since < 3 * 3_600_000);
      if (m.state === 'focus' && m.ends <= now && !open) m.state = 'idle';
      if (m.conn || m.state === 'focus') list.push(m);
    }
    // Focusing first, then longest focused today.
    return list.sort((a, b) => (a.state === 'focus' ? 0 : 1) - (b.state === 'focus' ? 0 : 1) || b.today - a.today);
  }, [res, now]);
}

// ---------- Feed, high fives, leaderboard ----------

export function useFeed(roomId: string, enabled: boolean): FeedItem[] | undefined {
  const [state, setState] = useState<{ room: string; items: FeedItem[] } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    return onValue(
      query(ref(db(), `feed/${roomId}`), orderByChild('at'), limitToLast(20)),
      (snap) => {
        const items = children(snap).map(({ key, val }) => {
          const o = (val ?? {}) as Raw;
          return {
            id: key,
            uid: str(o.uid),
            nick: str(o.nick),
            avatar: str(o.avatar, 'a01'),
            min: num(o.min),
            at: num(o.at),
            fives: Object.keys((o.fives as Raw | null) ?? {}),
          };
        });
        setState({ room: roomId, items: items.reverse() });
      },
      (e) => reportError(e, 'rooms feed'),
    );
  }, [roomId, enabled]);
  return state?.room === roomId ? state.items : undefined;
}

export function highFive(roomId: string, itemId: string) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return;
  set(ref(db(), `feed/${roomId}/${itemId}/fives/${uid}`), true).catch((e) => reportError(e, 'high five'));
}

/** Leaderboard periods: 'd20261123' (local day) and 'w202648' (ISO week). */
export function periodKey(kind: 'day' | 'week', now = Date.now()) {
  if (kind === 'day') return `d${localDay(now).replace(/-/g, '')}`;
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day + 3); // Thursday of this week decides the ISO year
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `w${d.getFullYear()}${String(week).padStart(2, '0')}`;
}

export function useBoard(roomId: string, period: string, enabled: boolean): BoardRow[] | undefined {
  const [state, setState] = useState<{ key: string; rows: BoardRow[] } | null>(null);
  const key = `${roomId}/${period}`;
  useEffect(() => {
    if (!enabled) return;
    return onValue(
      query(ref(db(), `board/${key}`), orderByChild('min'), limitToLast(10)),
      (snap) => {
        const rows = children(snap).map(({ key: uid, val }) => {
          const o = (val ?? {}) as Raw;
          return { uid, nick: str(o.nick), avatar: str(o.avatar, 'a01'), min: num(o.min) };
        });
        setState({ key, rows: rows.reverse() });
      },
      (e) => reportError(e, 'rooms board'),
    );
  }, [key, enabled]);
  return state?.key === key ? state.rows : undefined;
}

/**
 * After a focus session in a room: a "finished" post (completed sessions, not in quiet rooms) and,
 * if I opted in, minutes on today's and this week's leaderboard.
 */
export async function shareFocus(minutes: number, completed: boolean) {
  const cur = readCurrentRoom();
  const uid = getAuth().currentUser?.uid;
  if (!cur || !uid || minutes < 1) return;
  try {
    const profile = toProfile((await get(ref(db(), `profiles/${uid}`))).val());
    const room = toRoom(cur.id, (await get(ref(db(), `${cur.hidden ? 'hidden' : 'rooms'}/${cur.id}`))).val(), cur.hidden);
    if (!profile || !room) return;
    const min = Math.min(90, Math.round(minutes));
    if (completed && !room.quiet) {
      const item = push(ref(db(), `feed/${cur.id}`));
      await set(item, { uid, nick: profile.nick, avatar: profile.avatar, min, at: serverTimestamp() });
      addFootprint(`feed/${cur.id}/${item.key}`);
    }
    if (profile.board) {
      for (const period of [periodKey('day'), periodKey('week')]) {
        const path = `board/${cur.id}/${period}/${uid}`;
        await update(ref(db(), path), { nick: profile.nick, avatar: profile.avatar, min: increment(min), at: serverTimestamp() });
        addFootprint(path);
      }
    }
  } catch (e) {
    reportError(e, 'share focus');
  }
}

export type ReportReason = 'name' | 'nick' | 'spam' | 'other';

export function reportInRoom(roomId: string, why: ReportReason, targetUid?: string) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return;
  push(ref(db(), 'reports'), { by: uid, room: roomId, why, at: serverTimestamp(), ...(targetUid ? { uid: targetUid } : {}) })
    .catch((e: unknown) => reportError(e, 'report'));
}

// People I've hidden (only on this phone).
const HIDDEN_PEOPLE_KEY = 'rooms.hiddenPeople';
export function hidePerson(uid: string) {
  const ids = parseIds(storage.getString(HIDDEN_PEOPLE_KEY));
  if (!ids.includes(uid)) storage.set(HIDDEN_PEOPLE_KEY, JSON.stringify([...ids, uid]));
}
export function useHiddenPeople(): string[] {
  const [raw] = useMMKVString(HIDDEN_PEOPLE_KEY, storage);
  return useMemo(() => parseIds(raw), [raw]);
}

// ---------- Deleting my room data ----------

// Paths I wrote that can't be found again from my profile (posts, leaderboard rows, presence).
const FOOTPRINT_KEY = 'rooms.footprint';
function addFootprint(path: string) {
  const paths = parseIds(storage.getString(FOOTPRINT_KEY));
  if (!paths.includes(path)) storage.set(FOOTPRINT_KEY, JSON.stringify([...paths, path].slice(-500)));
}
async function clearFootprint(prefix: string) {
  const paths = parseIds(storage.getString(FOOTPRINT_KEY));
  const gone = paths.filter((p) => p.startsWith(prefix));
  if (!gone.length) return;
  await update(ref(db()), Object.fromEntries(gone.map((p) => [p, null])));
  storage.set(FOOTPRINT_KEY, JSON.stringify(paths.filter((p) => !p.startsWith(prefix))));
}

/**
 * Deletes everything I put in rooms: profile, nickname, rooms I created, posts, leaderboard rows,
 * presence. With `deleteAccount`, an anonymous sign-in is deleted too (a Google account is handled
 * by the backup's account deletion).
 */
export async function deleteRoomsData(deleteAccount: boolean) {
  const user = getAuth().currentUser;
  if (!user) return;
  const uid = user.uid;
  await leaveRoom();
  const updates: Record<string, null> = {};
  const owned = ((await get(ref(db(), `owned/${uid}`))).val() as Record<string, string> | null) ?? {};
  // Multi-path writes are all-or-nothing, so only delete rooms that still exist.
  for (const [slot, id] of Object.entries(owned)) {
    const hidden = toRoom(id, (await get(ref(db(), `hidden/${id}`))).val(), true);
    if (hidden) {
      updates[`hidden/${id}`] = null;
      if (hidden.code) updates[`codes/${hidden.code}`] = null;
    } else if ((await get(ref(db(), `rooms/${id}`))).exists()) {
      updates[`rooms/${id}`] = null;
    }
    updates[`owned/${uid}/${slot}`] = null;
  }
  for (const p of parseIds(storage.getString(FOOTPRINT_KEY))) updates[p] = null;
  const profile = toProfile((await get(ref(db(), `profiles/${uid}`))).val());
  if (profile) updates[`nicks/${profile.nick.toLowerCase()}`] = null;
  updates[`profiles/${uid}`] = null;
  await update(ref(db()), updates);
  storage.remove(FOOTPRINT_KEY);
  storage.remove(INVITE_KEY);
  if (deleteAccount && user.isAnonymous) await deleteUser(user);
}
