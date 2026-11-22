import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StaticScreenProps, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HabitId } from '../habits/types';
import { actions } from '../lib/actions';
import { radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { BreathingCircle } from '../components/BreathingCircle';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';

/** 4-4-6 breathing: a longer out-breath helps the body settle. */
const PHASES = [
  { label: 'urge.breatheIn', kind: 'in', secs: 4 },
  { label: 'urge.hold', kind: 'hold', secs: 4 },
  { label: 'urge.breatheOut', kind: 'out', secs: 6 },
] as const;
const ROUNDS = 4;

type Props = StaticScreenProps<{ habitId: HabitId }>;

export function UrgeScreen({ route }: Props) {
  const { t } = useTranslation();
  const c = useColors();
  const navigation = useNavigation();
  const [phase, setPhase] = useState(0);
  const [left, setLeft] = useState<number>(PHASES[0].secs);
  const [round, setRound] = useState(0);
  const finished = round >= ROUNDS;

  useEffect(() => {
    if (finished) return;
    const timer = setTimeout(() => {
      if (left > 1) return setLeft(left - 1);
      const np = (phase + 1) % PHASES.length;
      if (np === 0) setRound((r) => r + 1);
      setPhase(np);
      setLeft(PHASES[np].secs);
    }, 1000);
    return () => clearTimeout(timer);
  }, [left, phase, finished]);

  // A gentle tap at each phase change, so it can be followed with eyes closed.
  useEffect(() => {
    if (finished) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [phase, finished]);

  const restart = () => {
    setRound(0);
    setPhase(0);
    setLeft(PHASES[0].secs);
  };

  const current = PHASES[phase];

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={s.top}>
        <AppText variant="label">{finished ? ' ' : t('urge.round', { n: round + 1, total: ROUNDS })}</AppText>
        <Pressable
          onPress={navigation.goBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('urge.close')}
          style={[s.close, { backgroundColor: c.surfaceAlt }]}
        >
          <Ionicons name="close" size={22} color={c.text} />
        </Pressable>
      </View>

      {finished ? (
        <View style={s.center}>
          <Animated.View entering={ZoomIn.springify()} style={[s.doneBadge, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="checkmark" size={56} color={c.accent} />
          </Animated.View>
          <Animated.View entering={FadeIn.delay(200)} style={s.doneText}>
            <AppText variant="title" center>{t('urge.wellDone')}</AppText>
            <AppText variant="muted" center>{t('urge.urgePassed')}</AppText>
          </Animated.View>
        </View>
      ) : (
        <View style={s.center}>
          <BreathingCircle phase={current.kind} secs={current.secs}>
            <AppText variant="display" color={c.onAccent} style={s.count}>{left}</AppText>
          </BreathingCircle>
          <Animated.View key={`${round}-${phase}`} entering={FadeIn.duration(500)} style={s.phase}>
            <AppText variant="title" center color={c.accentText}>{t(current.label)}</AppText>
          </Animated.View>
          <AppText variant="muted" center>{t('urge.hint')}</AppText>
        </View>
      )}

      {finished ? (
        <Animated.View entering={FadeIn.delay(400)} style={s.buttons}>
          <Button label={t('urge.yes')} onPress={() => { actions.resistUrge(route.params.habitId); navigation.goBack(); }} />
          <Button variant="soft" label={t('urge.again')} onPress={restart} />
        </Animated.View>
      ) : (
        <View style={s.dots}>
          {Array.from({ length: ROUNDS }, (_, i) => (
            <View key={i} style={[s.dot, { backgroundColor: i < round ? c.accent : c.accentSoft }]} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 52, lineHeight: 60 },
  phase: { marginTop: 32, marginBottom: 4 },
  doneBadge: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  doneText: { marginTop: 24, gap: 4 },
  buttons: { gap: 10 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingBottom: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
