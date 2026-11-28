import React from 'react';
import { Text } from 'react-native';
import { createStaticNavigation, DarkTheme, DefaultTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTracked } from '../lib/storage';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { Palette } from '../theme';
import { BuddyScreen } from '../screens/Buddy';
import { CelebrateScreen } from '../screens/Celebrate';
import { CheckInScreen } from '../screens/CheckIn';
import { CreateRoomScreen } from '../screens/CreateRoom';
import { FocusScreen } from '../screens/Focus';
import { HomeScreen } from '../screens/Home';
import { JournalScreen } from '../screens/Journal';
import { LearnScreen } from '../screens/Learn';
import { MilestonesScreen } from '../screens/Milestones';
import { AddHabitScreen, OnboardingScreen } from '../screens/Onboarding';
import { PauseScreen } from '../screens/Pause';
import { PaywallScreen } from '../screens/Paywall';
import { ReelCheckScreen } from '../screens/ReelCheck';
import { ReelCounterSetupScreen } from '../screens/ReelCounterSetup';
import { ReelBlockingScreen } from '../screens/ReelBlocking';
import { ReelStatsScreen } from '../screens/ReelStats';
import { RoomScreen } from '../screens/Room';
import { RoomProfileScreen } from '../screens/RoomProfile';
import { RoomsScreen } from '../screens/Rooms';
import { SettingsScreen } from '../screens/Settings';
import { ShareScreen } from '../screens/Share';
import { StudyScreen } from '../screens/Study';
import { UrgeScreen } from '../screens/Urge';
import { VideoScreen } from '../screens/Video';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type TabKey = 'home' | 'focus' | 'rooms' | 'milestones' | 'settings';

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
  tabBar: (props) => <FloatingTabBar {...props} />,
  screenOptions: { headerShown: false },
  screens: {
    Home: { screen: HomeScreen, options: tabOptions('home', 'home-outline', 'home') },
    // Also opened by the "focus complete" notification: quitengine://focus
    Focus: { screen: FocusScreen, linking: 'focus', options: tabOptions('focus', 'timer-outline', 'timer') },
    Rooms: { screen: RoomsScreen, options: tabOptions('rooms', 'people-outline', 'people') },
    Milestones: { screen: MilestonesScreen, options: tabOptions('milestones', 'trophy-outline', 'trophy') },
    Settings: { screen: SettingsScreen, options: tabOptions('settings', 'settings-outline', 'settings') },
  },
});

/** Onboarding is done once at least one habit is being tracked. */
const useOnboarded = () => useTracked().length > 0;
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
        Celebrate: { screen: CelebrateScreen, options: { presentation: 'transparentModal', animation: 'fade' } },
        AddHabit: { screen: AddHabitScreen, options: { presentation: 'modal', animation: 'slide_from_bottom' } },
        Share: { screen: ShareScreen, options: { presentation: 'modal', animation: 'slide_from_bottom' } },
        Paywall: { screen: PaywallScreen, options: { presentation: 'modal', animation: 'slide_from_bottom' } },
        ReelCounterSetup: { screen: ReelCounterSetupScreen, options: { presentation: 'modal', animation: 'slide_from_bottom' } },
        ReelBlocking: { screen: ReelBlockingScreen, options: { presentation: 'modal', animation: 'slide_from_bottom' } },
        // "Check that counting works" (Settings → Reel counter)
        ReelCheck: { screen: ReelCheckScreen, options: { presentation: 'modal', animation: 'slide_from_bottom' } },
        // Reels history; also opened by the weekly summary notification: quitengine://reels
        ReelStats: { screen: ReelStatsScreen, linking: 'reels', options: { presentation: 'modal', animation: 'slide_from_bottom' } },
        // Opened by the reel counter at the daily limit: quitengine://pause?app=<package>
        Pause: { screen: PauseScreen, linking: 'pause', options: { presentation: 'fullScreenModal', animation: 'fade' } },
        Video: { screen: VideoScreen, options: { presentation: 'modal', animation: 'slide_from_bottom' } },
        // Evening check-in; also opened by the daily check-in notification: quitengine://checkin
        CheckIn: { screen: CheckInScreen, linking: 'checkin', options: { presentation: 'modal', animation: 'slide_from_bottom' } },
        Journal: { screen: JournalScreen, options: { presentation: 'modal', animation: 'slide_from_bottom' } },
        // Accountability buddy: pairing, their summary, "5 more" requests
        Buddy: { screen: BuddyScreen, linking: 'buddy', options: { presentation: 'modal', animation: 'slide_from_bottom' } },
        // Study time by day and subject, daily goal, my subjects (from the Focus tab)
        Study: { screen: StudyScreen, options: { presentation: 'modal', animation: 'slide_from_bottom' } },
        // "Learn instead", from the pause screen
        Learn: { screen: LearnScreen, options: { presentation: 'modal', animation: 'slide_from_bottom' } },
        Room: { screen: RoomScreen, options: { animation: 'slide_from_right' } },
        RoomProfile: { screen: RoomProfileScreen, options: { presentation: 'modal', animation: 'slide_from_bottom' } },
        CreateRoom: { screen: CreateRoomScreen, options: { presentation: 'modal', animation: 'slide_from_bottom' } },
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
  const base = c.scheme === 'dark' ? DarkTheme : DefaultTheme; // Midnight is always dark
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
