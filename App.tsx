import './src/i18n'; // initialise translations before anything renders
import React, { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useNavigationContainerRef } from '@react-navigation/native';
import { backupInBackground } from './src/lib/backup';
import { routeNotificationTaps, setupNotifications, syncNotifications } from './src/lib/notifications';
import { initPremium } from './src/lib/premium';
import { applyReelRules } from './src/lib/reels';
import { initRemoteConfig, remote } from './src/lib/remoteConfig';
import { readThemePref } from './src/lib/storage';
import { trackScreen } from './src/lib/telemetry';
import { updateStreakWidget } from './src/widget';
import { Navigation, navTheme } from './src/navigation';
import { applyThemePref, useColors } from './src/theme';

applyThemePref(readThemePref());
initRemoteConfig();
// Going to the background: quiet backup for signed-in users, and a fresh widget.
AppState.addEventListener('change', (state) => {
  if (state !== 'background') return;
  backupInBackground();
  updateStreakWidget();
});
// Create the Android channel, then refresh schedules (permission may have changed in system settings).
void setupNotifications().then(syncNotifications);
routeNotificationTaps();

export default function App() {
  const c = useColors();
  const theme = useMemo(() => navTheme(c), [c]);
  const navRef = useNavigationContainerRef();
  const lastRoute = useRef<string | undefined>(undefined);

  // Screen-view analytics: route names only (Home, Urge…), never habit names.
  const onNavChange = () => {
    const name = navRef.getCurrentRoute()?.name;
    if (name && name !== lastRoute.current) {
      lastRoute.current = name;
      trackScreen(name);
    }
  };

  // Purchases connect only when the UI starts (not in the background widget task).
  useEffect(() => {
    initPremium();
    applyReelRules(remote.reelRules()); // fixes for changed Instagram/YouTube screens, without an app update
  }, []);

  // Root view colour shows during screen transitions; keep it in step with the theme.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.bg);
  }, [c.bg]);

  return (
    <SafeAreaProvider>
      <StatusBar style={c.scheme === 'dark' ? 'light' : 'dark'} />
      <Navigation theme={theme} ref={navRef} onReady={onNavChange} onStateChange={onNavChange} />
    </SafeAreaProvider>
  );
}
