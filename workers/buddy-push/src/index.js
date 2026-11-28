/**
 * Quit Engine buddy push (Cloudflare Worker). POST /push with a Firebase ID token and { kind, id }.
 *
 *  - kind 'ask':    I just asked my buddy for more (request <id> is mine, still waiting, made in the last 10 min).
 *  - kind 'answer': I just answered my buddy's request <id> (it is theirs and now says yes or no).
 *
 * The database is read AS THE CALLER, so the database rules decide what the worker may see, and reading
 * with the token makes the database verify its signature. The buddy's push token (push/<uid>) is
 * readable only by the person they paired with. One FCM notification goes out; its text never names or
 * hints at a habit (it shows on the lock screen).
 *
 * Secret (wrangler secret put): FCM_SERVICE_ACCOUNT, the JSON key of a service account that has ONLY the
 * "Firebase Cloud Messaging API Admin" role (it can send notifications, nothing else). Vars in
 * wrangler.toml. Optional rate limit binding PUSH_LIMIT (per caller).
 */

const enc = new TextEncoder();
const ASK_WINDOW_MS = 10 * 60 * 1000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64urlJson = (o) => b64url(enc.encode(JSON.stringify(o)));

function readPayload(jwt) {
  const part = jwt.split('.')[1] ?? '';
  const padded = part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4);
  return JSON.parse(atob(padded));
}

/** Notification text per language. `name` is the nickname the asker chose for their buddy. */
const TEXT = {
  en: {
    buddy: 'Your buddy',
    askTitle: (name, n) => `${name} asks for ${n} more today`,
    askBody: 'Open Quit Engine to answer.',
    answerTitle: 'Your buddy answered',
    yes: (n) => `They said yes: +${n} for today.`,
    no: 'They said not now. Maybe a focus session instead?',
  },
  hi: {
    buddy: 'आपके बडी',
    askTitle: (name, n) => `${name} की रिक्वेस्ट: आज ${n} और`,
    askBody: 'जवाब देने के लिए Quit Engine खोलें।',
    answerTitle: 'आपके बडी ने जवाब दिया',
    yes: (n) => `उन्होंने हाँ कहा: आज के लिए +${n}।`,
    no: 'उन्होंने अभी नहीं कहा। फ़ोकस सेशन करके देखें?',
  },
};

/** Reads a database path as the user (their rules apply; a bad token gets 401). */
async function dbGet(env, path, idToken) {
  const res = await fetch(`${env.DB_URL}/${path}.json?auth=${encodeURIComponent(idToken)}`);
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, value: await res.json() };
}

function pemToBytes(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
}

let cachedAccess = null; // { token, exp } for this isolate

/** OAuth access token for FCM from the service account (RS256 JWT grant), cached until near expiry. */
async function fcmAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccess && cachedAccess.exp - 60 > now) return cachedAccess.token;
  const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT);
  const head = b64urlJson({ alg: 'RS256', typ: 'JWT' });
  const body = b64urlJson({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${head}.${body}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${head}.${body}.${b64url(sig)}`,
  });
  if (!res.ok) throw new Error(`oauth ${res.status}`);
  const out = await res.json();
  cachedAccess = { token: out.access_token, exp: now + (out.expires_in ?? 3600) };
  return cachedAccess.token;
}

async function sendFcm(env, message) {
  const access = await fcmAccessToken(env);
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return res.ok ? 'sent' : res.status === 404 ? 'stale token' : `fcm ${res.status}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/push') return json({ error: 'not found' }, 404);

    const idToken = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad request' }, 400);
    }
    const kind = body?.kind;
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!idToken || (kind !== 'ask' && kind !== 'answer') || !/^[-_A-Za-z0-9]{1,40}$/.test(id)) {
      return json({ error: 'bad request' }, 400);
    }

    let claims;
    try {
      claims = readPayload(idToken);
    } catch {
      return json({ error: 'unauthorized' }, 401);
    }
    const uid = claims.user_id ?? claims.sub;
    const now = Math.floor(Date.now() / 1000);
    const project = env.FIREBASE_PROJECT;
    if (typeof uid !== 'string' || claims.aud !== project || claims.iss !== `https://securetoken.google.com/${project}` || claims.exp < now) {
      return json({ error: 'unauthorized' }, 401);
    }
    if (env.PUSH_LIMIT) {
      const { success } = await env.PUSH_LIMIT.limit({ key: uid });
      if (!success) return json({ error: 'slow down' }, 429);
    }

    // My pairing record (reading it verifies the token), then theirs: both must name each other.
    const me = await dbGet(env, `buddy/${uid}`, idToken);
    if (!me.ok) return json({ error: 'unauthorized' }, 401);
    const other = me.value?.with;
    const code = me.value?.code;
    if (typeof other !== 'string' || typeof code !== 'string') return json({ error: 'not paired' }, 403);
    const them = await dbGet(env, `buddy/${other}`, idToken);
    if (!them.ok || them.value?.with !== uid || them.value?.code !== code) return json({ error: 'not paired' }, 403);

    // The request must match what just happened.
    const req = await dbGet(env, `breq/${code}/${id}`, idToken);
    const r = req.ok ? req.value : null;
    const n = Math.min(10, Math.max(1, Number(r?.n) || 5));
    if (kind === 'ask') {
      if (!r || r.from !== uid || r.state !== 'wait' || !(r.at > Date.now() - ASK_WINDOW_MS)) return json({ error: 'no such request' }, 409);
    } else if (!r || r.from !== other || (r.state !== 'yes' && r.state !== 'no')) {
      return json({ error: 'no such answer' }, 409);
    }

    const target = await dbGet(env, `push/${other}`, idToken);
    const token = target.ok ? target.value?.t : null;
    if (typeof token !== 'string') return json({ sent: false, reason: 'no token' });
    const text = TEXT[target.value?.lang] ?? TEXT.en;

    let title;
    let msg;
    if (kind === 'ask') {
      const name = await dbGet(env, `bstatus/${uid}/name`, idToken);
      title = text.askTitle(name.ok && typeof name.value === 'string' ? name.value : text.buddy, n);
      msg = text.askBody;
    } else {
      title = text.answerTitle;
      msg = r.state === 'yes' ? text.yes(n) : text.no;
    }

    const result = await sendFcm(env, {
      token,
      notification: { title, body: msg },
      data: { url: 'quitengine://buddy' },
      android: { priority: 'HIGH', notification: { channel_id: 'buddy', tag: `buddy-${kind}-${id}` } },
    });
    return json(result === 'sent' ? { sent: true } : { sent: false, reason: result });
  },
};
