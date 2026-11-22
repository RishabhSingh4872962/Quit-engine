import React, { useEffect } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ACTIVE_HABIT as habit } from '../habits';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import { useHabitState } from '../lib/storage';
import { milestoneProgress, useNow } from '../lib/streak';
import { fonts, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { StreakRing } from '../components/StreakRing';

export function HomeScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const state = useHabitState();
  const now = useNow();

  const started = state.streakStart !== null;
  const { days, next, progress } = milestoneProgress(state.streakStart, habit.milestones, now);
  const best = Math.max(state.bestStreakDays, days);
  const focused = useIsFocused();

  // Celebrate the highest milestone reached since the last celebration (also covers days away from the app).
  const toCelebrate = [...habit.milestones].reverse().find((m) => started && m <= days && m > state.celebrated);
  useEffect(() => {
    if (!focused || toCelebrate === undefined) return;
    actions.markCelebrated(toCelebrate);
    navigation.navigate('Celebrate', { days: toCelebrate });
  }, [focused, toCelebrate, navigation]);

  const status = !started
    ? t('home.notStarted')
    : next !== undefined
      ? t('home.nextMilestone', { count: next - days })
      : t('home.allMilestones');

  const confirmSlip = () =>
    Alert.alert(t('home.slipTitle'), t('home.slipBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('home.slipConfirm'), onPress: actions.relapse },
    ]);

  return (
    <Screen scroll>
      <Animated.View entering={FadeIn.duration(500)}>
        <AppText variant="title">{habit.name[lang]}</AppText>
        <AppText variant="muted">{habit.tagline[lang]}</AppText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(600)} style={s.ring}>
        <StreakRing progress={started ? progress : 0}>
          <AppText variant="display" color={c.accentText}>{days}</AppText>
          <AppText variant="muted" style={s.daysLabel}>{t('common.days', { count: days })}</AppText>
        </StreakRing>
        <AppText variant="muted" center style={s.status}>{status}</AppText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(600)} style={s.stats}>
        <Stat icon="shield-checkmark" value={String(state.urgesResisted)} label={t('home.urgesResisted')} />
        <Stat icon="trophy" value={`${best} ${t('common.days', { count: best })}`} label={t('home.bestStreak')} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(600)} style={s.actions}>
        {started ? (
          <>
            <Button icon="leaf" label={t('home.urgeButton')} onPress={() => navigation.navigate('Urge')} />
            <Button variant="ghost" label={t('home.slipped')} onPress={confirmSlip} />
          </>
        ) : (
          <Button icon="play" label={t('home.startStreak')} onPress={() => void actions.startStreak()} />
        )}
      </Animated.View>
    </Screen>
  );
}

function Stat({ icon, value, label }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; value: string; label: string;
}) {
  const c = useColors();
  return (
    <Card style={s.stat}>
      <View style={[s.statIcon, { backgroundColor: c.accentSoft }]}>
        <Ionicons name={icon} size={18} color={c.accent} />
      </View>
      <AppText style={s.statValue}>{value}</AppText>
      <AppText variant="caption">{label}</AppText>
    </Card>
  );
}

const s = StyleSheet.create({
  ring: { alignItems: 'center', marginTop: 28, marginBottom: 24 },
  daysLabel: { marginTop: -4 },
  status: { marginTop: 18 },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  stat: { flex: 1, gap: 4 },
  statIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30, includeFontPadding: false },
  actions: { gap: 4 },
});
