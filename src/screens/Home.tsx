import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import { premiumHasValueFor, usePremium } from '../lib/premium';
import { remote } from '../lib/remoteConfig';
import { readPaywallOffered, useActiveHabit, useHabitState, useTracked } from '../lib/storage';
import { reelCounterAvailable } from '../lib/reels';
import { confirmSlip } from '../lib/slip';
import { useBuddy } from '../lib/buddy';
import { screenTimeAvailable } from '../lib/screenTime';
import { milestoneProgress, useNow } from '../lib/streak';
import { fonts, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { HabitSwitcher } from '../components/HabitSwitcher';
import { IconButton } from '../components/IconButton';
import { JournalCard } from '../components/JournalCard';
import { AskCard } from './Buddy';
import { Screen } from '../components/Screen';
import { ReelsTodayCard } from '../components/ReelsTodayCard';
import { ScreenTimeCard } from '../components/ScreenTimeCard';
import { StreakRing } from '../components/StreakRing';

export function HomeScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const habit = useActiveHabit();
  const state = useHabitState(habit.id);
  const now = useNow();
  const focused = useIsFocused();
  const buddy = useBuddy();

  const started = state.streakStart !== null;
  const { days, next, progress } = milestoneProgress(state.streakStart, habit.milestones, now);
  const best = Math.max(state.bestStreakDays, days);
  const totalFree = state.pastDaysFree + days; // all streaks together; a slip never takes these away

  // Celebrate the highest milestone reached since the last celebration (also covers days away from the app).
  const toCelebrate = [...habit.milestones].reverse().find((m) => started && m <= days && m > state.celebrated);
  useEffect(() => {
    if (!focused || toCelebrate === undefined) return;
    actions.markCelebrated(habit.id, toCelebrate);
    navigation.navigate('Celebrate', { habitId: habit.id, days: toCelebrate });
  }, [focused, toCelebrate, habit.id, navigation]);

  // Offer Premium once (after onboarding, or when a habit with Premium features is added), never mid-celebration.
  const tracked = useTracked();
  const premium = usePremium();
  useEffect(() => {
    if (!focused || premium || toCelebrate !== undefined || readPaywallOffered()) return;
    if (!premiumHasValueFor(tracked) || !remote.paywallAfterOnboarding()) return;
    actions.markPaywallOffered();
    navigation.navigate('Paywall');
  }, [focused, premium, toCelebrate, tracked, navigation]);

  const status = !started
    ? t('home.notStarted')
    : next !== undefined
      ? t('home.nextMilestone', { count: next - days })
      : t('home.allMilestones');

  return (
    <Screen scroll>
      <HabitSwitcher />

      {buddy.kind === 'paired' && buddy.asks.map((a) => <AskCard key={a.id} ask={a} name={buddy.status?.name} />)}

      <Animated.View key={habit.id} entering={FadeIn.duration(400)} style={s.header}>
        <View style={s.headerText}>
          <AppText variant="title">{habit.name[lang]}</AppText>
          <AppText variant="muted">{habit.tagline[lang]}</AppText>
        </View>
        {started && days > 0 && (
          <IconButton
            icon="share-social-outline"
            label={t('share.title')}
            onPress={() => navigation.navigate('Share', { habitId: habit.id })}
            filled
          />
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(600)} style={s.ring}>
        <StreakRing progress={started ? progress : 0}>
          <AppText variant="display" color={c.accentText}>{days}</AppText>
          <AppText variant="muted" style={s.daysLabel}>{t('common.days', { count: days })}</AppText>
        </StreakRing>
        <AppText variant="muted" center style={s.status}>{status}</AppText>
        {state.pastDaysFree > 0 && (
          <Animated.View entering={FadeIn.duration(400)} style={[s.total, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="leaf" size={14} color={c.accentText} />
            <AppText variant="caption" color={c.accentText} style={s.totalText}>
              {t('home.totalFree', { count: totalFree })}
            </AppText>
          </Animated.View>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(600)} style={s.stats}>
        <Stat icon="shield-checkmark" value={String(state.urgesResisted)} label={t('home.urgesResisted')} />
        <Stat icon="trophy" value={`${best} ${t('common.days', { count: best })}`} label={t('home.bestStreak')} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(600)} style={s.actions}>
        {started ? (
          <>
            <Button
              icon="leaf"
              label={habit.urgeButton?.[lang] ?? t('home.urgeButton')}
              onPress={() => navigation.navigate('Urge', { habitId: habit.id })}
            />
            <Button variant="ghost" label={t('home.slipped')} onPress={() => confirmSlip(habit.id, t)} />
          </>
        ) : (
          <Button icon="play" label={t('home.startStreak')} onPress={() => void actions.startStreak(habit.id)} />
        )}
      </Animated.View>

      {started && (
        <Animated.View key={`journal-${habit.id}`} entering={FadeInDown.delay(330).duration(600)} style={s.screenTime}>
          <JournalCard habit={habit} now={now} />
        </Animated.View>
      )}

      {habit.reelApps && reelCounterAvailable && (
        <Animated.View key={`reels-${habit.id}`} entering={FadeInDown.delay(350).duration(600)} style={s.screenTime}>
          <ReelsTodayCard apps={habit.reelApps} />
        </Animated.View>
      )}

      {habit.screenTime && screenTimeAvailable && (
        <Animated.View key={`screen-time-${habit.id}`} entering={FadeInDown.delay(400).duration(600)} style={s.screenTime}>
          <ScreenTimeCard apps={habit.screenTime.apps} />
        </Animated.View>
      )}
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
  header: { marginTop: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1 },
  ring: { alignItems: 'center', marginTop: 24, marginBottom: 24 },
  daysLabel: { marginTop: -4 },
  status: { marginTop: 18 },
  total: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  totalText: { fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  stat: { flex: 1, gap: 4 },
  statIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30, includeFontPadding: false },
  actions: { gap: 4 },
  screenTime: { marginTop: 24 },
});
