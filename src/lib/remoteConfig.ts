import { fetchAndActivate, getRemoteConfig, getValue } from '@react-native-firebase/remote-config';
import { reportError } from './telemetry';

/**
 * Values that can be changed from the Firebase console without an app update.
 * The app always works with these defaults, even offline or before the first fetch.
 */
const DEFAULTS = {
  cloud_backup_enabled: true, // kill switch for the backup feature
  breathing_rounds: 4, // rounds in the urge breathing exercise
};

export function initRemoteConfig() {
  const rc = getRemoteConfig();
  rc.defaultConfig = DEFAULTS;
  rc.settings = {
    minimumFetchIntervalMillis: __DEV__ ? 0 : 12 * 60 * 60 * 1000,
    fetchTimeoutMillis: 10_000,
  };
  // New values apply from the next time they are read; nothing waits on this.
  fetchAndActivate(rc).catch((e) => reportError(e, 'remote config fetch'));
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export const remote = {
  cloudBackupEnabled: () => getValue(getRemoteConfig(), 'cloud_backup_enabled').asBoolean(),
  breathingRounds: () => clamp(getValue(getRemoteConfig(), 'breathing_rounds').asNumber() || 4, 1, 10),
};
