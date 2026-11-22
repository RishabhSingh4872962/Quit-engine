import React from 'react';
import { Text } from 'react-native';
import { createStaticNavigation, DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { ACTIVE_HABIT } from '../habits';
import { useHabitState } from '../lib/storage';
import { Palette } from '../theme';
import { HomeScreen } from '../screens/Home';
import { OnboardingScreen } from '../screens/Onboarding';
import { SettingsScreen } from '../screens/Settings';
import { UrgeScreen } from '../screens/Urge';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type TabKey = 'home' | 'milestones' | 'settings';

/** Label as a component so it re-renders when the language changes. */
function TabLabel({ tab, color }: { tab: TabKey; color: string }) {
  const { t } = useTranslation();
  return <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{t(`tabs.${tab}`)}</Text>;
}

const tabOptions = (tab: TabKey, icon: IconName, activeIcon: IconName) => ({
  tabBarLabel: ({ color }: { color: string }) => <TabLabel tab={tab} color={color} />,
  tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? activeIcon : icon} size={size} color={color} />
  ),
});

const Tabs = createBottomTabNavigator({
  screenOptions: { headerShown: false },
  screens: {
    Home: { screen: HomeScreen, options: tabOptions('home', 'home-outline', 'home') },
    Settings: { screen: SettingsScreen, options: tabOptions('settings', 'settings-outline', 'settings') },
  },
});

function useOnboarded() {
  const { quizAnswers } = useHabitState();
  return ACTIVE_HABIT.quiz.every((q) => q.id in quizAnswers);
}
const useNeedsOnboarding = () => !useOnboarded();

const RootStack = createNativeStackNavigator({
  screenOptions: { headerShown: false },
  groups: {
    Onboarding: {
      if: useNeedsOnboarding,
      screens: { Onboarding: OnboardingScreen },
    },
    App: {
      if: useOnboarded,
      screens: {
        Main: Tabs,
        Urge: { screen: UrgeScreen, options: { presentation: 'fullScreenModal', animation: 'fade_from_bottom' } },
      },
    },
  },
});

type RootStackType = typeof RootStack;
declare module '@react-navigation/native' {
  // Makes useNavigation() and navigate('Urge') type-checked app-wide.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface RootNavigator extends RootStackType {}
}

export const Navigation = createStaticNavigation(RootStack);

export function navTheme(c: Palette): Theme {
  const base = c.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.accent,
      background: c.bg,
      card: c.surface,
      text: c.text,
      border: c.border,
      notification: c.accent,
    },
  };
}
