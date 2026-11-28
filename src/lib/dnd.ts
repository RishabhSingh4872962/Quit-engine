import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import ReelGuard from '../../modules/reel-guard';
import { exactAlarmsAllowed } from './notifications';
import { reportError } from './telemetry';

/**
 * "Silence notifications while focusing" (Android): Do Not Disturb (priority only) for the session.
 * The native side turns it back off just before the session ends, even if the app isn't open. That
 * needs exact alarms ("Alarms & reminders"); without them DND is not used, so it never outlasts a session.
 */
export const dndAvailable = Platform.OS === 'android' && ReelGuard !== null;

export function hasDndAccess() {
  try {
    return ReelGuard?.dndAccess() ?? false;
  } catch {
    return false;
  }
}

export const openDndAccess = () => ReelGuard?.openDndAccess();

/** Both permissions DND needs, re-checked when the user comes back from settings. */
export function useDndReady() {
  const [ready, setReady] = useState({ access: hasDndAccess(), exact: true });
  useEffect(() => {
    const check = () => void exactAlarmsAllowed().then((exact) => setReady({ access: hasDndAccess(), exact }));
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, []);
  return ready;
}

/** True if DND was turned on (needs access; never touches a DND the user already had on). */
export function startFocusDnd(until: number) {
  try {
    return ReelGuard?.startFocusDnd(until) ?? false;
  } catch (e) {
    reportError(e, 'focus dnd');
    return false;
  }
}

export function endFocusDnd() {
  try {
    ReelGuard?.endFocusDnd();
  } catch (e) {
    reportError(e, 'focus dnd');
  }
}
