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
  /** Detection rules as JSON (from Remote Config); null restores the built-in ones. */
  setRules(json: string | null): void;
  addListener(event: 'onChange', listener: () => void): EventSubscription;
}

/** Android only; null on iOS and web. */
export default requireOptionalNativeModule<ReelGuardModule>('ReelGuard');
