import { requireOptionalNativeModule } from 'expo';

interface ScreenTimeModule {
  /** True once the user has allowed Usage access for this app. */
  hasUsageAccess(): boolean;
  /** Opens the system Usage access screen. */
  openUsageAccessSettings(): void;
  /**
   * Foreground time per package for each period between consecutive `boundaries`
   * (epoch ms, ascending). Packages with no use are left out.
   */
  getForegroundTime(packages: string[], boundaries: number[]): Promise<Record<string, number>[]>;
}

/** Android only; null on iOS and web, where the native module doesn't exist. */
export default requireOptionalNativeModule<ScreenTimeModule>('ScreenTime');
