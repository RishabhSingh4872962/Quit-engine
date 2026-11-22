import { requireOptionalNativeModule } from 'expo';
import type { EventSubscription } from 'expo';

export interface ReelDay {
  day: string; // YYYY-MM-DD, local time
  apps: Record<string, { count: number; ms: number }>; // by package id
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
  /** Opens an installed app by package; false if it can't be opened. */
  openApp(pkg: string): boolean;
  /** Detection rules as JSON (from Remote Config); null restores the built-in ones. */
  setRules(json: string | null): void;
  addListener(event: 'onChange', listener: () => void): EventSubscription;
}

/** Android only; null on iOS and web. */
export default requireOptionalNativeModule<ReelGuardModule>('ReelGuard');
