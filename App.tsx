import './src/i18n'; // initialise translations before anything renders
import React, { useEffect, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { readThemePref } from './src/lib/storage';
import { Navigation, navTheme } from './src/navigation';
import { applyThemePref, useColors } from './src/theme';

applyThemePref(readThemePref());

export default function App() {
  const c = useColors();
  const theme = useMemo(() => navTheme(c), [c]);

  // Root view colour shows during screen transitions; keep it in step with the theme.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.bg);
  }, [c.bg]);

  return (
    <SafeAreaProvider>
      <StatusBar style={c.scheme === 'dark' ? 'light' : 'dark'} />
      <Navigation theme={theme} />
    </SafeAreaProvider>
  );
}
