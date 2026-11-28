import { requireOptionalNativeModule } from 'expo';
import type { EventSubscription } from 'expo';

export interface ReelDay {
  day: string; // YYYY-MM-DD, local time
  // by package id; opens = times the app came to the front, skips = "Not now" on the pause before opening
  apps: Record<string, { count: number; ms: number; opens?: number; skips?: number }>;
  hours: number[]; // reels per hour of the day (0–23), all apps together
}

interface ReelGuardModule {
  /** True once the user has switched the service on in Accessibility settings. */
  isEnabled(): boolean;
  /** Opens this app's Accessibility settings page. */
  openSettings(): void;
  /** Last `days` days, oldest first. */
  getStats(days: number): ReelDay[];
  /** Daily reel limit (0 = off) and nudge text with {count} and {limit} placeholders. */
  setLimit(limit: number, nudge: string): void;
  getLimitState(): { limit: number; extraToday: number; pausesOffToday: boolean };
  /** "5 more": the next pause comes at limit + extra (today only). */
  addExtraToday(n: number): void;
  setPausesOffToday(): void;
  /**
   * Blocking rules (JSON): { apps: string[], appLimits: {pkg: n}, windows: [[startMin, endMin]],
   * until: epochMs, text } where text is the note shown when reels are blocked. null = off.
   */
  setBlock(json: string | null): void;
  /** Live counter bubble while watching reels; text with a {count} placeholder. */
  setBubble(on: boolean, text: string): void;
  /** Forgets today's "5 more", "no more pauses" and earlier pauses. */
  resetToday(): void;
  /** Opens an installed app by package; false if it can't be opened. */
  openApp(pkg: string): boolean;
  /**
   * "Pause before opening": { apps: string[], breath: seconds, grace: minutes, names: {pkg: name},
   * text: { title, breatheIn, breatheOut, ask, opensOne, opensOther, stay, open } }; null = off.
   */
  setGate(json: string | null): void;
  /** "Count in browsers": Shorts/Reels pages in browsers, read from the address bar only. */
  setWeb(on: boolean): void;
  /** Which of these packages are installed (they must be listed in the module's manifest <queries>). */
  installedApps(pkgs: string[]): string[];
  /** Detection rules as JSON (from Remote Config); null restores the built-in ones. */
  setRules(json: string | null): void;
  addListener(event: 'onChange', listener: () => void): EventSubscription;
}

/** Android only; null on iOS and web. */
export default requireOptionalNativeModule<ReelGuardModule>('ReelGuard');
