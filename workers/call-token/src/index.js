/**
 * Quit Engine call tokens (Cloudflare Worker). POST /token with a Firebase ID token and { room }.
 *
 * Gives a LiveKit join token only if:
 *  - the Firebase token is genuine: the Realtime Database checks its signature when we read with it,
 *  - the person is in that room right now (their here/<room>/<uid> marker; banned people can't set it),
 *  - the room is invite-only (calls are not allowed in public rooms).
 *
 * Secrets (wrangler secret put): LIVEKIT_API_KEY, LIVEKIT_API_SECRET. Vars in wrangler.toml.
 */

const enc = new TextEncoder();

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

/** HS256 JWT, the format LiveKit access tokens use. */
async function sign(payload, secret) {
  const head = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson(payload);
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

/** Reads a database path as the user (their rules apply; a bad token gets 401). */
async function dbGet(env, path, idToken) {
  const res = await fetch(`${env.DB_URL}/${path}.json?auth=${encodeURIComponent(idToken)}`);
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, value: await res.json() };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/token') return json({ error: 'not found' }, 404);

    const idToken = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad request' }, 400);
    }
    const room = typeof body?.room === 'string' ? body.room : '';
    if (!idToken || !/^[-_A-Za-z0-9]{10,40}$/.test(room)) return json({ error: 'bad request' }, 400);

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

    // Reading with the token makes the database verify its signature; the uid comes from that token.
    const here = await dbGet(env, `here/${room}/${uid}`, idToken);
    if (!here.ok) return json({ error: 'unauthorized' }, 401);
    if (here.value !== true) return json({ error: 'join the room first' }, 403);
    const name = await dbGet(env, `hidden/${room}/name`, idToken);
    if (!name.ok || typeof name.value !== 'string') return json({ error: 'calls are only in invite-only rooms' }, 403);
    const nick = await dbGet(env, `profiles/${uid}/nick`, idToken);

    const token = await sign(
      {
        iss: env.LIVEKIT_API_KEY,
        sub: uid,
        name: nick.ok && typeof nick.value === 'string' ? nick.value : 'guest',
        nbf: now - 10,
        exp: now + 2 * 3600,
        video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false },
      },
      env.LIVEKIT_API_SECRET,
    );
    return json({ token, url: env.LIVEKIT_URL });
  },
};
