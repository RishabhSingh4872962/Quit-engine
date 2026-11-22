import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { StaticScreenProps, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HABIT_LIST } from '../habits';
import { actions } from '../lib/actions';
import { allowMoreReelsToday, openReelApp, stopPausesToday, useReelLimit } from '../lib/reels';
import { readState, useTracked } from '../lib/storage';
import { AppText } from '../components/AppText';
import { BreathingCircle } from '../components/BreathingCircle';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';

type Props = StaticScreenProps<{ app?: string } | undefined>;

const PHASES = [
  { label: 'pause.in', kind: 'in', secs: 4 },
  { label: 'pause.out', kind: 'out', secs: 6 },
] as const;

/**
 * Opened by the reel counter (quitengine://pause?app=…) when the daily limit is reached.
 * A slow breath, then the user decides. Every option is one tap; nothing is locked.
 */
export function PauseScreen({ route }: Props) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const limit = useReelLimit();
  const tracked = useTracked();
  const app = route.params?.app;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setPhase((p) => (p + 1) % PHASES.length), PHASES[phase].secs * 1000);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return () => clearTimeout(timer);
  }, [phase]);

  // Only mention the streak if a reels habit's streak is actually running.
  const streakRunning = HABIT_LIST.some(
    (h) => h.reelApps && tracked.includes(h.id) && readState(h.id).streakStart !== null,
  );

  const close = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'));
  const backToApp = () => {
    if (app) openReelApp(app);
    close();
  };
  const current = PHASES[phase];

  return (
    <Screen edges={['top', 'bottom']} style={s.screen}>
      <Animated.View entering={FadeIn.duration(500)} style={s.top}>
        <AppText variant="title" center>{t('pause.title', { count: limit })}</AppText>
        <AppText variant="muted" center>{t('pause.sub')}</AppText>
      </Animated.View>

      <View style={s.circle}>
        <BreathingCircle phase={current.kind} secs={current.secs} size={230} />
        <AppText variant="heading" center style={s.phase}>{t(current.label)}</AppText>
      </View>

      <View style={s.actions}>
        <Button label={t('pause.done')} onPress={close} />
        <Button
          variant="ghost"
          label={t('pause.more')}
          onPress={() => {
            allowMoreReelsToday(5, HABIT_LIST.flatMap((h) => h.reelApps?.map((a) => a.id) ?? []));
            backToApp();
          }}
        />
        {streakRunning && <AppText variant="caption" center style={s.note}>{t('pause.moreNote')}</AppText>}
        <Pressable
          onPress={() => {
            stopPausesToday();
            actions.checkReelLimit();
            backToApp();
          }}
          hitSlop={8}
          accessibilityRole="button"
        >
          <AppText variant="caption" center style={s.off}>{t('pause.off')}</AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  screen: { justifyContent: 'space-between' },
  top: { gap: 8, marginTop: 24 },
  circle: { alignItems: 'center' },
  phase: { marginTop: 16 },
  actions: { gap: 4 },
  note: { marginBottom: 8, paddingHorizontal: 12 },
  off: { textDecorationLine: 'underline', paddingVertical: 8 },
});
