// Tests the buddy push Worker (workers/buddy-push) against the local Realtime Database emulator and its
// real rules. Google's OAuth and FCM endpoints are faked here; nothing reaches the live services.
// Run: npx -y firebase-tools@latest emulators:exec --only database "node scripts/test-buddy-push.mjs"
import { Buffer } from 'node:buffer';
import process from 'node:process';
import worker from '../workers/buddy-push/src/index.js';

const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9000';
const NS = 'quit-engine-app-default-rtdb';
const PROJECT = 'quit-engine-app';
const DB = 'http://db.test';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// The emulator accepts unsigned tokens; the worker checks aud/iss/exp itself.
const idToken = (uid, extra = {}) =>
  `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    sub: uid, user_id: uid, aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`,
    iat: 0, exp: Math.floor(Date.now() / 1000) + 3600, firebase: { sign_in_provider: 'anonymous' }, ...extra,
  })}.`;

// A throwaway RSA key stands in for the service account; the fake OAuth endpoint verifies its signature.
const keys = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify'],
);
const pkcs8 = Buffer.from(await crypto.subtle.exportKey('pkcs8', keys.privateKey)).toString('base64');
const pem = `-----BEGIN PRIVATE KEY-----\n${pkcs8.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;

const sent = []; // FCM messages
let oauthCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.origin === DB) {
    // Forward database reads to the emulator (with the caller's ?auth=, so the rules apply).
    return realFetch(`http://${HOST}${url.pathname}?ns=${NS}&auth=${url.searchParams.get('auth')}`);
  }
  if (url.href === 'https://oauth2.googleapis.com/token') {
    oauthCalls++;
    const assertion = new URLSearchParams(init.body).get('assertion');
    const [head, body, sig] = assertion.split('.');
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', keys.publicKey, Buffer.from(sig, 'base64url'), new TextEncoder().encode(`${head}.${body}`),
    );
    const claims = JSON.parse(Buffer.from(body, 'base64url'));
    if (!ok || claims.iss !== 'push@test.iam' || !claims.scope.includes('firebase.messaging')) return new Response('{}', { status: 400 });
    return new Response(JSON.stringify({ access_token: 'test-access', expires_in: 3600 }), { status: 200 });
  }
  if (url.href === `https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`) {
    if (init.headers.authorization !== 'Bearer test-access') return new Response('{}', { status: 401 });
    const { message } = JSON.parse(init.body);
    if (message.token.startsWith('stale')) return new Response('{}', { status: 404 });
    sent.push(message);
    return new Response('{"name":"m1"}', { status: 200 });
  }
  throw new Error(`unexpected fetch ${url.href}`);
};

const env = { DB_URL: DB, FIREBASE_PROJECT: PROJECT, FCM_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'push@test.iam', private_key: pem }) };

async function admin(method, path, body) {
  const res = await realFetch(`http://${HOST}/${path}.json?ns=${NS}`, {
    method, headers: { Authorization: 'Bearer owner' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`seed ${path}: ${res.status}`);
}

async function call(uid, payload, { token = uid && idToken(uid), path = '/push', env: e = env } = {}) {
  const res = await worker.fetch(
    new Request(`https://push.test${path}`, {
      method: 'POST',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    }),
    e,
  );
  return { status: res.status, body: await res.json() };
}

let failed = 0;
function check(name, pass, detail = '') {
  if (!pass) failed++;
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${pass ? '' : `  ${detail}`}`);
}

// Seed a paired couple (pcarol hears in Hindi, pdave in English) and an outsider.
const now = Date.now();
await admin('PUT', 'pairs/PSH234', { a: 'pcarol', b: 'pdave', at: now });
await admin('PUT', 'buddy/pcarol', { with: 'pdave', code: 'PSH234', at: now });
await admin('PUT', 'buddy/pdave', { with: 'pcarol', code: 'PSH234', at: now });
await admin('PUT', 'buddy/peve', { with: 'pzed', code: 'PSZ234', at: now });
await admin('PUT', 'bstatus/pdave', { name: 'Dave', streak: 3, focus: 20, day: '2026-11-28', at: now });
await admin('PUT', 'push/pcarol', { t: `carol-${'t'.repeat(30)}`, lang: 'hi', at: now });
await admin('PUT', 'push/pdave', { t: `dave-${'t'.repeat(30)}`, lang: 'en', at: now });
await admin('PUT', 'breq/PSH234/r1', { from: 'pdave', n: 5, at: now, state: 'wait' });
await admin('PUT', 'breq/PSH234/old', { from: 'pdave', n: 5, at: now - 20 * 60_000, state: 'wait' });
await admin('PUT', 'breq/PSH234/c1', { from: 'pcarol', n: 5, at: now, state: 'wait' });

console.log('Buddy push worker');
let r = await call('pdave', { kind: 'ask', id: 'r1' });
let m = sent.at(-1);
check('dave asks: carol gets one notification', r.status === 200 && r.body.sent === true && sent.length === 1, JSON.stringify(r));
check('  to carol\'s token, in Hindi, with dave\'s buddy name', m?.token.startsWith('carol-') && m.notification.title === 'Dave की रिक्वेस्ट: आज 5 और', m?.notification?.title);
check('  opens the buddy screen on the buddy channel', m?.data.url === 'quitengine://buddy' && m.android.notification.channel_id === 'buddy' && m.android.notification.tag === 'buddy-ask-r1');
check('  text never mentions reels', !/reel|रील/i.test(JSON.stringify(m?.notification)));

r = await call('pdave', { kind: 'answer', id: 'r1' });
check('dave "answers" his own request', r.status === 409, JSON.stringify(r));
r = await call('pcarol', { kind: 'ask', id: 'r1' });
check('carol "asks" with dave\'s request', r.status === 409, JSON.stringify(r));
r = await call('pdave', { kind: 'ask', id: 'old' });
check('ask for a request older than 10 minutes', r.status === 409, JSON.stringify(r));
r = await call('pdave', { kind: 'ask', id: 'nope' });
check('ask for a request that does not exist', r.status === 409, JSON.stringify(r));
r = await call('pcarol', { kind: 'answer', id: 'r1' });
check('carol "answers" before saying yes or no', r.status === 409, JSON.stringify(r));

await admin('PATCH', 'breq/PSH234/r1', { state: 'yes' });
r = await call('pcarol', { kind: 'answer', id: 'r1' });
m = sent.at(-1);
check('carol says yes: dave hears it in English', r.body.sent === true && m?.token.startsWith('dave-') && m.notification.title === 'Your buddy answered' && m.notification.body === 'They said yes: +5 for today.', JSON.stringify(m?.notification));
await admin('PATCH', 'breq/PSH234/c1', { state: 'no' });
r = await call('pdave', { kind: 'answer', id: 'c1' });
m = sent.at(-1);
check('dave says not now: carol hears it in Hindi', r.body.sent === true && m?.notification.body === 'उन्होंने अभी नहीं कहा। फ़ोकस सेशन करके देखें?', JSON.stringify(m?.notification));
check('one OAuth token reused for all sends', oauthCalls === 1, String(oauthCalls));

r = await call('peve', { kind: 'ask', id: 'r1' });
check('eve (paired with someone else) pushes into their pair', r.status === 403, JSON.stringify(r));
r = await call('pzed', { kind: 'ask', id: 'r1' });
check('someone with no pairing at all', r.status === 403, JSON.stringify(r));
await admin('PUT', 'buddy/pcarol', { with: 'pzed', code: 'PSH234', at: now });
await admin('PUT', 'breq/PSH234/r2', { from: 'pdave', n: 5, at: Date.now(), state: 'wait' });
r = await call('pdave', { kind: 'ask', id: 'r2' });
check('carol no longer names dave (pairing ended on her side)', r.status === 403, JSON.stringify(r));
await admin('PUT', 'buddy/pcarol', { with: 'pdave', code: 'PSH234', at: now });

await admin('DELETE', 'bstatus/pdave');
await admin('PUT', 'push/pcarol', { t: `carol-${'t'.repeat(30)}`, lang: 'en', at: now });
r = await call('pdave', { kind: 'ask', id: 'r2' });
m = sent.at(-1);
check('without a shared name the title says "Your buddy"', r.body.sent === true && m?.notification.title === 'Your buddy asks for 5 more today', JSON.stringify(m?.notification));
await admin('PUT', 'push/pcarol', { t: `stale-${'t'.repeat(30)}`, lang: 'en', at: now });
r = await call('pdave', { kind: 'ask', id: 'r2' });
check('a token FCM no longer knows', r.status === 200 && r.body.sent === false && r.body.reason === 'stale token', JSON.stringify(r));
await admin('DELETE', 'push/pcarol');
const before = sent.length;
r = await call('pdave', { kind: 'ask', id: 'r2' });
check('carol has no push token: nothing is sent', r.body.sent === false && r.body.reason === 'no token' && sent.length === before, JSON.stringify(r));

r = await call('pdave', { kind: 'ask', id: 'r2' }, { token: idToken('pdave', { exp: 1 }) });
check('expired ID token', r.status === 401, JSON.stringify(r));
r = await call('pdave', { kind: 'ask', id: 'r2' }, { token: idToken('pdave', { aud: 'other-project' }) });
check('ID token from another project', r.status === 401, JSON.stringify(r));
r = await call(null, { kind: 'ask', id: 'r2' });
check('no ID token', r.status === 400, JSON.stringify(r));
r = await call('pdave', { kind: 'spam', id: 'r2' });
check('unknown kind', r.status === 400, JSON.stringify(r));
r = await call('pdave', { kind: 'ask', id: '../pairs' });
check('id with a path in it', r.status === 400, JSON.stringify(r));
r = await call('pdave', 'not json');
check('body that is not JSON', r.status === 400, JSON.stringify(r));
r = await call('pdave', { kind: 'ask', id: 'r2' }, { path: '/token' });
check('other paths', r.status === 404, JSON.stringify(r));
r = await call('pdave', { kind: 'ask', id: 'r2' }, { env: { ...env, PUSH_LIMIT: { limit: async () => ({ success: false }) } } });
check('rate limited', r.status === 429, JSON.stringify(r));

for (const p of ['pairs/PSH234', 'buddy/pcarol', 'buddy/pdave', 'buddy/peve', 'push/pdave', 'breq/PSH234']) await admin('DELETE', p);
console.log(failed ? `\n${failed} FAILED` : '\nAll buddy push tests passed');
process.exit(failed ? 1 : 0);
