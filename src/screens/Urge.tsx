import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StaticScreenProps, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HABITS } from '../habits';
import { HabitId } from '../habits/types';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import { triggerOptions } from '../lib/journal';
import { remote } from '../lib/remoteConfig';
import { radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { BreathingCircle } from '../components/BreathingCircle';
import { Button } from '../components/Button';
import { ChoiceChips, ScalePicker } from '../components/Pickers';
import { Screen } from '../components/Screen';

/** 4-4-6 breathing: a longer out-breath helps the body settle. */
const PHASES = [
  { label: 'urge.breatheIn', kind: 'in', secs: 4 },
  { label: 'urge.hold', kind: 'hold', secs: 4 },
  { label: 'urge.breatheOut', kind: 'out', secs: 6 },
] as const;

type Props = StaticScreenProps<{ habitId: HabitId }>;

export function UrgeScreen({ route }: Props) {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const habit = HABITS[route.params.habitId];
  const [ROUNDS] = useState(remote.breathingRounds); // tunable from Remote Config
  // Urge diary (optional): what set it off and how strong it was. Saved with "Yes, it passed".
  const [trigger, setTrigger] = useState<string>();
  const [strength, setStrength] = useState<number>();
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
        <ScrollView style={s.flex} contentContainerStyle={s.done} showsVerticalScrollIndicator={false}>
          <Animated.View entering={ZoomIn.springify()} style={[s.doneBadge, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="checkmark" size={44} color={c.accent} />
          </Animated.View>
          <Animated.View entering={FadeIn.delay(200)} style={s.doneText}>
            <AppText variant="title" center>{t('urge.wellDone')}</AppText>
            <AppText variant="muted" center>{t('urge.urgePassed')}</AppText>
          </Animated.View>
          <Animated.View entering={FadeIn.delay(400)} style={s.diary}>
            <View style={s.labelRow}>
              <AppText variant="label">{t('journal.whatSetOff')}</AppText>
              <View style={s.private}>
                <Ionicons name="lock-closed-outline" size={12} color={c.textMuted} />
                <AppText variant="caption">{t('journal.privateShort')}</AppText>
              </View>
            </View>
            <ChoiceChips options={triggerOptions(habit, lang, t)} value={trigger} onChange={setTrigger} />
            <AppText variant="label" style={s.diaryGap}>{t('journal.howStrong')}</AppText>
            <ScalePicker
              labels={['1', '2', '3', '4', '5']}
              a11y={(n) => t('journal.strengthA11y', { n })}
              value={strength}
              onChange={setStrength}
            />
            <View style={s.ends}>
              <AppText variant="caption">{t('journal.mild')}</AppText>
              <AppText variant="caption">{t('journal.veryStrong')}</AppText>
            </View>
          </Animated.View>
        </ScrollView>
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
          <Button label={t('urge.yes')} onPress={() => { actions.resistUrge(habit.id, { trigger, strength }); navigation.goBack(); }} />
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
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  done: { alignItems: 'center', paddingTop: 12, paddingBottom: 20 },
  count: { fontSize: 52, lineHeight: 60 },
  phase: { marginTop: 32, marginBottom: 4 },
  doneBadge: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  doneText: { marginTop: 16, gap: 4 },
  diary: { alignSelf: 'stretch', marginTop: 24, gap: 10 },
  diaryGap: { marginTop: 8 },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  private: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  buttons: { gap: 10, paddingTop: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingBottom: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
