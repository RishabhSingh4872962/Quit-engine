import { PermissionsAndroid, Platform } from 'react-native';
import { getAuth } from '@react-native-firebase/auth';

/**
 * Voice/video calls in invite-only rooms (LiveKit). A Cloudflare Worker (workers/call-token) gives a
 * join token only to someone who is in that invite-only room right now. Audio and video go straight
 * to LiveKit and are never recorded or stored by us.
 */

const CALLS_URL = process.env.EXPO_PUBLIC_CALLS_URL;
export const callsAvailable = Boolean(CALLS_URL);

export class CallError extends Error {
  constructor(public readonly reason: 'offline' | 'denied' | 'failed') {
    super(reason);
  }
}

export async function getCallToken(roomId: string): Promise<{ token: string; url: string }> {
  const user = getAuth().currentUser;
  if (!CALLS_URL || !user) throw new CallError('failed');
  let res: Response;
  try {
    res = await fetch(`${CALLS_URL}/token`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await user.getIdToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ room: roomId }),
    });
  } catch {
    throw new CallError('offline');
  }
  if (res.status === 401 || res.status === 403) throw new CallError('denied');
  if (!res.ok) throw new CallError('failed');
  const data = (await res.json()) as { token?: unknown; url?: unknown };
  if (typeof data.token !== 'string' || typeof data.url !== 'string') throw new CallError('failed');
  return { token: data.token, url: data.url };
}

/** Asks for the microphone (or camera) when it's first needed. */
export async function askPermission(kind: 'mic' | 'camera') {
  if (Platform.OS !== 'android') return true;
  const perm = kind === 'mic' ? PermissionsAndroid.PERMISSIONS.RECORD_AUDIO : PermissionsAndroid.PERMISSIONS.CAMERA;
  return (await PermissionsAndroid.request(perm)) === PermissionsAndroid.RESULTS.GRANTED;
}
