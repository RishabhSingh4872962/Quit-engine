import i18n from './src/i18n'; // initialise translations before anything renders
import React, { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useNavigationContainerRef } from '@react-navigation/native';
import { backupInBackground } from './src/lib/backup';
import { routeNotificationTaps, setupNotifications, syncNotifications } from './src/lib/notifications';
import { initPremium } from './src/lib/premium';
import { actions } from './src/lib/actions';
import { syncReelBlock } from './src/lib/blocking';
import { applyReelRules, syncReelLimit } from './src/lib/reels';
import { initRemoteConfig, remote } from './src/lib/remoteConfig';
import { resumeRoom } from './src/lib/rooms';
import { readThemePref } from './src/lib/storage';
import { trackScreen } from './src/lib/telemetry';
import { updateStreakWidget } from './src/widget';
import { Navigation, navTheme } from './src/navigation';
import { applyThemePref, useColors } from './src/theme';

// Links into the app: the reel counter opens quitengine://pause at the daily limit.
const linking = { prefixes: ['quitengine://'] };

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
    syncReelLimit(); // limit, bubble and their texts
    syncReelBlock(); // blocking rules (also turns them off if Premium ended)
    actions.checkReelLimit(); // a day over the reel limit ends the reel-free streak
    actions.checkFocus(); // finishes a focus session that ended while the app was closed
    resumeRoom(); // back into the room I was in (presence)
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      actions.checkReelLimit();
      actions.checkFocus();
      syncReelBlock();
    });
    const onLang = () => {
      syncReelLimit(); // texts shown by the service follow the app language
      syncReelBlock();
    };
    i18n.on('languageChanged', onLang);
    return () => {
      sub.remove();
      i18n.off('languageChanged', onLang);
    };
  }, []);

  // Root view colour shows during screen transitions; keep it in step with the theme.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.bg);
  }, [c.bg]);

  return (
    <SafeAreaProvider>
      <StatusBar style={c.scheme === 'dark' ? 'light' : 'dark'} />
      <Navigation theme={theme} linking={linking} ref={navRef} onReady={onNavChange} onStateChange={onNavChange} />
    </SafeAreaProvider>
  );
}
