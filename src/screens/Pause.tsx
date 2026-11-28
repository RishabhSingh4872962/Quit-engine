import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StackActions, StaticScreenProps, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HABIT_LIST } from '../habits';
import { actions } from '../lib/actions';
import { EARN_CAP, EARN_FOCUS_MINUTES, EARN_FOCUS_REELS, EARN_LEARN_REELS, useEarnedToday } from '../lib/earn';
import { useFocusPrefs, useFocusSession } from '../lib/focus';
import { usePremium } from '../lib/premium';
import { allowMoreReelsToday, openReelApp, stopPausesToday, useReelLimit } from '../lib/reels';
import { readState, useTracked } from '../lib/storage';
import { useNow } from '../lib/streak';
import { radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { BreathingCircle } from '../components/BreathingCircle';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';

type Props = StaticScreenProps<{ app?: string } | undefined>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const PHASES = [
  { label: 'pause.in', kind: 'in', secs: 4 },
  { label: 'pause.out', kind: 'out', secs: 6 },
] as const;

/**
 * Opened by the reel counter (quitengine://pause?app=…) when the daily limit is reached.
 * A slow breath, then the user decides. Every option is one tap; nothing is locked. Reels can
 * also be earned with a little effort; those raise today's limit instead of breaking it.
 */
export function PauseScreen({ route }: Props) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const limit = useReelLimit();
  const tracked = useTracked();
  const now = useNow();
  const earned = useEarnedToday(now);
  const session = useFocusSession();
  const focusPrefs = useFocusPrefs();
  const premium = usePremium();
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

  // popTo: back to the tabs if they're below (navigate would push a second copy); else replace this screen.
  const close = () => (navigation.canGoBack() ? navigation.goBack() : navigation.dispatch(StackActions.popTo('Main')));
  const backToApp = () => {
    if (app) openReelApp(app);
    close();
  };
  const left = Math.max(0, EARN_CAP - earned);
  const earnByFocus = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    actions.startFocus({ mode: 'timer', minutes: EARN_FOCUS_MINUTES }, premium && focusPrefs.blockReels, {
      earn: EARN_FOCUS_REELS,
    });
    navigation.dispatch(StackActions.popTo('Main', { screen: 'Focus' }));
  };
  const current = PHASES[phase];

  return (
    <Screen scroll edges={['top', 'bottom']} style={s.screen}>
      <Animated.View entering={FadeIn.duration(500)} style={s.top}>
        <AppText variant="title" center>{t('pause.title', { count: limit + earned })}</AppText>
        <AppText variant="muted" center>{t('pause.sub')}</AppText>
      </Animated.View>

      <View style={s.circle}>
        <BreathingCircle phase={current.kind} secs={current.secs} size={170} />
        <AppText variant="heading" center style={s.phase}>{t(current.label)}</AppText>
      </View>

      <Card style={s.earn}>
        <AppText variant="heading">{t('pause.earnTitle')}</AppText>
        <AppText variant="caption">{t('pause.earnSub')}</AppText>
        {left > 0 ? (
          <View style={s.earnRow}>
            <EarnOption
              icon="timer-outline"
              title={t('pause.earnFocus', { count: EARN_FOCUS_MINUTES })}
              reward={t('pause.reward', { count: Math.min(EARN_FOCUS_REELS, left) })}
              note={session ? t('pause.earnBusy') : undefined}
              onPress={earnByFocus}
              disabled={!!session}
            />
            <EarnOption
              icon="school-outline"
              title={t('pause.earnLearn', { count: 5 })}
              reward={t('pause.reward', { count: Math.min(EARN_LEARN_REELS, left) })}
              onPress={() => navigation.navigate('Learn', { app })}
            />
          </View>
        ) : (
          <AppText variant="muted">{t('pause.earnCapped', { count: EARN_CAP })}</AppText>
        )}
        {earned > 0 && left > 0 && <AppText variant="caption">{t('pause.earnedToday', { count: earned })}</AppText>}
      </Card>

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

function EarnOption({ icon, title, reward, note, onPress, disabled }: {
  icon: IconName; title: string; reward: string; note?: string; onPress: () => void; disabled?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={`${title}, ${reward}`}
      style={({ pressed }) => [s.option, { backgroundColor: c.surfaceAlt }, (pressed || disabled) && s.dim]}
    >
      <View style={[s.optionIcon, { backgroundColor: c.accentSoft }]}>
        <Ionicons name={icon} size={20} color={c.accent} />
      </View>
      <AppText style={s.optionTitle}>{title}</AppText>
      <AppText variant="caption" color={c.accentText} style={s.reward}>{note ?? reward}</AppText>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flexGrow: 1, justifyContent: 'space-between', gap: 20 },
  top: { gap: 8, marginTop: 16 },
  circle: { alignItems: 'center' },
  phase: { marginTop: 12 },
  earn: { gap: 8 },
  earnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  option: { flex: 1, borderRadius: radius.md, padding: 14, gap: 6 },
  dim: { opacity: 0.6 },
  optionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontWeight: '700', fontSize: 15, lineHeight: 20 },
  reward: { fontWeight: '600' },
  actions: { gap: 4 },
  note: { marginBottom: 8, paddingHorizontal: 12 },
  off: { textDecorationLine: 'underline', paddingVertical: 8 },
});
