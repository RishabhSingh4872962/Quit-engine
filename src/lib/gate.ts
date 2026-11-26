import { useMemo } from 'react';
import { useMMKVString } from 'react-native-mmkv';
import ReelGuard from '../../modules/reel-guard';
import { HABIT_LIST } from '../habits';
import i18n from '../i18n';
import { storage } from './storage';
import { reportError } from './telemetry';

/**
 * "Pause before opening" (like one sec): when a chosen app comes to the front, the reel service
 * shows a short breathing screen first. Settings live here; the native service does the rest.
 * Nothing about which apps or how often goes to analytics (it would hint at the habit).
 */

export interface GatePrefs {
  apps: string[]; // package ids
  breath: number; // seconds
  grace: number; // minutes without a pause after choosing "Open"
}

export const BREATH_OPTIONS = [5, 10, 15] as const;
export const GRACE_OPTIONS = [5, 15, 30] as const;
const DEFAULT_GATE: GatePrefs = { apps: [], breath: 10, grace: 15 };
const KEY = 'gate.prefs';

const parse = (raw: string | undefined): GatePrefs => {
  try {
    const v = { ...DEFAULT_GATE, ...(raw ? (JSON.parse(raw) as Partial<GatePrefs>) : {}) };
    return { ...v, apps: Array.isArray(v.apps) ? v.apps.filter((a) => typeof a === 'string') : [] };
  } catch {
    return DEFAULT_GATE;
  }
};

export const readGate = () => parse(storage.getString(KEY));
export const writeGate = (patch: Partial<GatePrefs>) => storage.set(KEY, JSON.stringify({ ...readGate(), ...patch }));

export function useGate(): GatePrefs {
  const [raw] = useMMKVString(KEY, storage);
  return useMemo(() => parse(raw), [raw]);
}

/** All apps offered by tracked or untracked habits (today only Reels offers them). */
export const gateAppList = () => {
  const seen = new Set<string>();
  return HABIT_LIST.flatMap((h) => h.gateApps ?? []).filter((a) => !seen.has(a.id) && seen.add(a.id));
};

/** The offered apps that are installed on this phone. */
export function installedGateApps() {
  const list = gateAppList();
  try {
    const installed = new Set(ReelGuard?.installedApps(list.map((a) => a.id)) ?? []);
    return list.filter((a) => installed.has(a.id));
  } catch (e) {
    reportError(e, 'installed apps');
    return [];
  }
}

/** Sends the settings and their texts (in the app's language) to the native service. */
export function syncGate() {
  try {
    const p = readGate();
    if (!ReelGuard) return;
    if (!p.apps.length) return ReelGuard.setGate(null);
    const t = i18n.getFixedT(i18n.language);
    const names = Object.fromEntries(gateAppList().map((a) => [a.id, a.name]));
    ReelGuard.setGate(
      JSON.stringify({
        apps: p.apps,
        breath: p.breath,
        grace: p.grace,
        names,
        text: {
          title: t('gate.title'),
          breatheIn: t('gate.breatheIn'),
          breatheOut: t('gate.breatheOut'),
          ask: t('gate.ask'),
          // Native placeholders use single braces: {app}, {count}.
          opensOne: t('gate.opensOne'),
          opensOther: t('gate.opensOther'),
          stay: t('gate.stay'),
          open: t('gate.open'),
        },
      }),
    );
  } catch (e) {
    reportError(e, 'gate sync');
  }
}
