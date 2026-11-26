// Tests database.rules.json against the local Realtime Database emulator (never the live database).
// Run: npx -y firebase-tools@latest emulators:exec --only database "node scripts/test-db-rules.mjs"
import { Buffer } from 'node:buffer';
import process from 'node:process';

const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9000';
const NS = 'quit-engine-app-default-rtdb';
const TS = { '.sv': 'timestamp' };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// The emulator accepts unsigned tokens, so we can act as any user.
const token = (uid) =>
  `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: uid, user_id: uid, iat: 0, exp: 4e9, firebase: { sign_in_provider: 'anonymous' } })}.`;

// Admin uses the "Bearer owner" header (bypasses rules); users pass their ID token as ?auth=.
async function call(method, path, uid, body) {
  const userAuth = uid && uid !== 'owner' ? `&auth=${token(uid)}` : '';
  const res = await fetch(`http://${HOST}/${path}.json?ns=${NS}${userAuth}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(uid === 'owner' ? { Authorization: 'Bearer owner' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json().catch(() => null) };
}
const put = (path, uid, body) => call('PUT', path, uid, body);
const patch = (path, uid, body) => call('PATCH', path, uid, body);
const get = (path, uid) => call('GET', path, uid);
const del = (path, uid) => call('DELETE', path, uid);

let failed = 0;
async function expect(name, want, promise) {
  const { ok } = await promise;
  const pass = ok === want;
  if (!pass) failed++;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${want ? 'allow' : 'deny '}  ${name}`);
}

const profile = (nick, extra = {}) => ({ nick, avatar: 'a01', board: false, at: TS, ...extra });
const room = (owner, slot, extra = {}) => ({
  name: 'Night coders', kind: 'custom', tag: 'coding', focus: 50, brk: 10, quiet: false, strict: false,
  max: 20, owner, slot, at: TS, ...extra,
});
const presence = (nick, extra = {}) => ({ nick, avatar: 'a01', state: 'idle', since: TS, ends: 0, away: false, conn: true, ...extra });

// ---- Setup as admin: an official room and a clean slate.
await put('', 'owner', null);
await put('rooms/jee', 'owner', { name: 'JEE Prep', kind: 'study', tag: 'jee', focus: 50, brk: 10, quiet: false, strict: false, max: 100, owner: '', slot: '', at: 0 });

console.log('\nProfiles & nicknames');
await expect('anyone signed out reads profiles', false, get('profiles', null));
await expect('alice claims nick + profile together', true, patch('', 'alice', { 'nicks/alice_1': 'alice', 'profiles/alice': profile('Alice_1') }));
await expect('bob takes alice\'s nick', false, patch('', 'bob', { 'nicks/alice_1': 'bob', 'profiles/bob': profile('alice_1') }));
await expect('bob profile without claiming the nick', false, put('profiles/bob', 'bob', profile('Bobby')));
await expect('nick with a space', false, patch('', 'bob', { 'nicks/bo b': 'bob', 'profiles/bob': profile('bo b') }));
await expect('free-text avatar', false, patch('', 'bob', { 'nicks/bobby': 'bob', 'profiles/bob': profile('Bobby', { avatar: 'idiot' }) }));
await expect('bob valid profile', true, patch('', 'bob', { 'nicks/bobby': 'bob', 'profiles/bob': profile('Bobby') }));
await expect('alice edits bob\'s profile', false, patch('profiles/bob', 'alice', { avatar: 'a02' }));
await expect('alice renames: releases old nick, claims new', true, patch('', 'alice', { 'nicks/alice_1': null, 'nicks/alice_2': 'alice', 'profiles/alice/nick': 'alice_2' }));
await expect('bob releases alice\'s nick', false, del('nicks/alice_2', 'bob'));
await expect('deleting a nick that is already gone (no-op)', true, del('nicks/nobody_here', 'bob'));
await expect('unknown profile field', false, patch('profiles/alice', 'alice', { email: 'x@y.z' }));

console.log('\nPresence');
await expect('alice joins official room', true, put('online/jee/alice', 'alice', presence('alice_2')));
await expect('alice joins with bob\'s nick', false, put('online/jee/alice', 'alice', presence('Bobby')));
await expect('alice writes bob\'s presence', false, put('online/jee/bob', 'alice', presence('Bobby')));
await expect('presence in a room that does not exist', false, put('online/nope/alice', 'alice', presence('alice_2')));
await expect('alice starts focus (50 min)', true, patch('online/jee/alice', 'alice', { state: 'focus', ends: Date.now() + 50 * 60000 }));
await expect('focus ending in 3 hours', false, patch('online/jee/alice', 'alice', { ends: Date.now() + 180 * 60000 }));
await expect('alice marks herself away', true, patch('online/jee/alice', 'alice', { away: true }));
await expect('signed-in users read presence', true, get('online/jee', 'bob'));
await expect('alice goes offline (onDisconnect-style update)', true, patch('online/jee/alice', 'alice', { conn: false }));
await expect('bob removes alice while she is still focusing', false, del('online/jee/alice', 'bob'));
await put('online/jee/ghost', 'owner', { nick: 'ghost', avatar: 'a01', state: 'idle', since: Date.now() - 3600000, ends: 0, away: false, conn: false });
await expect('bob cleans up a stale offline member', true, del('online/jee/ghost', 'bob'));
await put('online/jee/fresh', 'owner', { nick: 'fresh', avatar: 'a01', state: 'idle', since: Date.now(), ends: 0, away: false, conn: false });
await expect('bob removes someone who just went offline', false, del('online/jee/fresh', 'bob'));
await expect('presence without conn', false, put('online/jee/alice', 'alice', { nick: 'alice_2', avatar: 'a01', state: 'idle', since: TS, ends: 0, away: false }));

console.log('\nOnline markers (count = number of markers)');
await expect('alice marks herself here', true, put('here/jee/alice', 'alice', true));
await expect('marking twice is harmless', true, put('here/jee/alice', 'alice', true));
await expect('alice marks bob here', false, put('here/jee/bob', 'alice', true));
await expect('marker with another value', false, put('here/jee/alice', 'alice', 5));
await expect('marker in a room that does not exist', false, put('here/nope/alice', 'alice', true));
await expect('signed-in users read all markers', true, get('here', 'bob'));
await expect('signed-out users read markers', false, get('here', null));
await expect('alice removes her marker', true, del('here/jee/alice', 'alice'));

console.log('\nCustom rooms');
await expect('bob creates a public room in slot 1', true, patch('', 'bob', { 'rooms/r1': room('bob', 's1'), 'owned/bob/s1': 'r1' }));
await expect('bob reuses slot 1', false, patch('', 'bob', { 'rooms/r9': room('bob', 's1'), 'owned/bob/s1': 'r9' }));
await expect('bob room in slot 2', true, patch('', 'bob', { 'rooms/r2': room('bob', 's2'), 'owned/bob/s2': 'r2' }));
await expect('bob room in slot 3', true, patch('', 'bob', { 'rooms/r3': room('bob', 's3'), 'owned/bob/s3': 'r3' }));
await expect('bob 4th room (slot 4)', false, patch('', 'bob', { 'rooms/r4': room('bob', 's4'), 'owned/bob/s4': 'r4' }));
await expect('bob frees a slot but keeps the room', false, del('owned/bob/s3', 'bob'));
await expect('room name with a link', false, patch('', 'alice', { 'rooms/ra': room('alice', 's1', { name: 'join http://spam.example' }), 'owned/alice/s1': 'ra' }));
await expect('room pretending to be official', false, patch('', 'alice', { 'rooms/ra': room('alice', 's1', { kind: 'study' }), 'owned/alice/s1': 'ra' }));
await expect('room owned by someone else', false, patch('', 'alice', { 'rooms/ra': room('bob', 's1'), 'owned/alice/s1': 'ra' }));
await expect('alice deletes bob\'s room', false, del('rooms/r1', 'alice'));
await expect('alice edits the official room', false, patch('rooms/jee', 'alice', { name: 'Hacked' }));
await expect('bob renames his room', true, patch('rooms/r1', 'bob', { name: 'Night coders 2' }));
await expect('bob deletes room 3 and frees its slot', true, patch('', 'bob', { 'rooms/r3': null, 'owned/bob/s3': null }));

console.log('\nInvite-only rooms');
await expect('alice creates a hidden room with code', true, patch('', 'alice', { 'hidden/h1': room('alice', 's1', { code: 'ABC123' }), 'owned/alice/s1': 'h1', 'codes/ABC123': 'h1' }));
await expect('bob steals the code for his room', false, put('codes/ABC123', 'bob', 'r1'));
await expect('bob looks up the code', true, get('codes/ABC123', 'bob'));
await expect('bob reads the hidden room by id', true, get('hidden/h1', 'bob'));
await expect('bob lists all hidden rooms', false, get('hidden', 'bob'));
await expect('bob joins the hidden room', true, put('online/h1/bob', 'bob', presence('Bobby')));

console.log('\nFeed & high fives');
await expect('alice posts a finished session', true, put('feed/jee/f1', 'alice', { uid: 'alice', nick: 'alice_2', avatar: 'a01', min: 50, at: TS }));
await expect('alice posts as bob', false, put('feed/jee/f2', 'alice', { uid: 'bob', nick: 'Bobby', avatar: 'a01', min: 50, at: TS }));
await expect('a 2-hour "session"', false, put('feed/jee/f3', 'alice', { uid: 'alice', nick: 'alice_2', avatar: 'a01', min: 120, at: TS }));
await expect('bob high-fives', true, put('feed/jee/f1/fives/bob', 'bob', true));
await expect('high five on a post that does not exist', false, put('feed/jee/nope/fives/bob', 'bob', true));
await expect('bob high-fives for alice', false, put('feed/jee/f1/fives/alice', 'bob', true));
await expect('bob edits alice\'s post', false, patch('feed/jee/f1', 'bob', { min: 90 }));
await expect('bob deletes alice\'s fresh post', false, del('feed/jee/f1', 'bob'));
await expect('deleting a post that is already gone (no-op)', true, del('feed/jee/gone', 'bob'));
await expect('alice deletes her own post', true, del('feed/jee/f1', 'alice'));

console.log('\nLeaderboard (opt-in)');
const day = 'd20261123';
await expect('bob (not opted in) posts minutes', false, put(`board/jee/${day}/bob`, 'bob', { nick: 'Bobby', avatar: 'a01', min: 25, at: TS }));
await patch('profiles/alice', 'alice', { board: true });
await expect('alice (opted in) posts 25 min', true, put(`board/jee/${day}/alice`, 'alice', { nick: 'alice_2', avatar: 'a01', min: 25, at: TS }));
await expect('alice adds 25 more right away', false, patch(`board/jee/${day}/alice`, 'alice', { min: 50, at: TS }));
await expect('alice posts 120 min at once', false, put(`board/jee/d20261124/alice`, 'alice', { nick: 'alice_2', avatar: 'a01', min: 120, at: TS }));
await expect('bad period key', false, put('board/jee/today/alice', 'alice', { nick: 'alice_2', avatar: 'a01', min: 10, at: TS }));
await expect('alice opts out: deletes her entry', true, del(`board/jee/${day}/alice`, 'alice'));

console.log('\nReports & bans');
await expect('bob reports a nickname', true, put('reports/x1', 'bob', { by: 'bob', room: 'jee', uid: 'alice', why: 'nick', at: TS }));
await expect('bob reads reports', false, get('reports', 'bob'));
await expect('report with free text', false, put('reports/x2', 'bob', { by: 'bob', room: 'jee', why: 'nick', at: TS, text: 'hi' }));
await put('bans/alice', 'owner', true);
await expect('banned alice updates presence', false, patch('online/jee/alice', 'alice', { away: false }));
await expect('banned alice can still leave (delete presence)', true, del('online/jee/alice', 'alice'));
await expect('banned alice posts to the feed', false, put('feed/jee/f9', 'alice', { uid: 'alice', nick: 'alice_2', avatar: 'a01', min: 25, at: TS }));
await expect('banned alice can still delete her profile', true, patch('', 'alice', { 'profiles/alice': null, 'nicks/alice_2': null }));
await expect('anyone reads bans', false, get('bans', 'bob'));

console.log(failed ? `\n${failed} FAILED` : '\nAll rules tests passed');
process.exit(failed ? 1 : 0);
