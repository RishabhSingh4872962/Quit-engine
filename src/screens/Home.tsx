import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HabitConfig } from '../habits/types';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import { useBuddy } from '../lib/buddy';
import { STAGE_NAMES, useCompanion } from '../lib/companion';
import { EVENING_HOUR, MOODS, pledgeStreak, useJournalDays } from '../lib/journal';
import { premiumHasValueFor, usePremium } from '../lib/premium';
import { localDay, reelCounterAvailable } from '../lib/reels';
import { remote } from '../lib/remoteConfig';
import { screenTimeAvailable } from '../lib/screenTime';
import { confirmSlip } from '../lib/slip';
import { readPaywallOffered, useActiveHabit, useHabitState, useTracked } from '../lib/storage';
import { milestoneProgress, useNow } from '../lib/streak';
import { radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { HabitPicker } from '../components/HabitPicker';
import { IconButton } from '../components/IconButton';
import { MoneyCard } from '../components/MoneyCard';
import { Orb } from '../components/Orb';
import { Plant } from '../components/Plant';
import { ReelsTodayCard } from '../components/ReelsTodayCard';
import { ScreenTimeCard } from '../components/ScreenTimeCard';
import { Screen } from '../components/Screen';
import { AskCard } from './Buddy';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

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
      {/* A soft halo of the habit's colour behind the hero. */}
      <View pointerEvents="none" style={[s.halo, { backgroundImage: `radial-gradient(circle, ${c.glow} 0%, rgba(0,0,0,0) 62%)` }]} />

      <View style={s.top}>
        <HabitPicker />
        <View style={s.topActions}>
          {started && (
            <IconButton icon="book-outline" label={t('journal.open')} onPress={() => navigation.navigate('Journal', { habitId: habit.id })} filled />
          )}
          {started && days > 0 && (
            <IconButton icon="share-social-outline" label={t('share.title')} onPress={() => navigation.navigate('Share', { habitId: habit.id })} filled />
          )}
        </View>
      </View>
      <AppText variant="muted" style={s.tagline}>{habit.tagline[lang]}</AppText>

      {buddy.kind === 'paired' && buddy.asks.map((a) => <AskCard key={a.id} ask={a} name={buddy.status?.name} />)}

      <Animated.View key={habit.id} entering={FadeIn.duration(500)} style={s.hero}>
        <Orb value={days} label={t('common.days', { count: days })} progress={started ? progress : 0} />
        <View style={[s.chip, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
          {started && next !== undefined && (
            <View style={[s.chipTrack, { backgroundColor: c.surfaceHigh }]}>
              <View style={[s.chipFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: c.accentText }]} />
            </View>
          )}
          <AppText variant="caption" color={c.text}>{status}</AppText>
        </View>
        {state.pastDaysFree > 0 && (
          <AppText variant="caption" color={c.accentText} style={s.total}>{t('home.totalFree', { count: totalFree })}</AppText>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(500)} style={s.actions}>
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
        <Animated.View entering={FadeInDown.delay(250).duration(500)} style={s.grid}>
          <View style={s.gridRow}>
            <Tile icon="shield-checkmark" value={String(state.urgesResisted)} label={t('home.urgesResisted')} />
            <Tile icon="trophy" value={`${best}`} unit={t('common.days', { count: best })} label={t('home.bestStreak')} />
          </View>
          <View style={s.gridRow}>
            <PromiseTile habit={habit} now={now} />
            <PlantTile now={now} />
          </View>
        </Animated.View>
      )}

      {started && habit.savings && (
        <Animated.View key={`money-${habit.id}`} entering={FadeInDown.delay(300).duration(500)} style={s.card}>
          <MoneyCard habit={habit} now={now} />
        </Animated.View>
      )}

      {habit.reelApps && reelCounterAvailable && (
        <Animated.View key={`reels-${habit.id}`} entering={FadeInDown.delay(320).duration(500)} style={s.card}>
          <ReelsTodayCard apps={habit.reelApps} />
        </Animated.View>
      )}

      {habit.screenTime && screenTimeAvailable && (
        <Animated.View key={`screen-time-${habit.id}`} entering={FadeInDown.delay(360).duration(500)} style={s.card}>
          <ScreenTimeCard apps={habit.screenTime.apps} />
        </Animated.View>
      )}
    </Screen>
  );
}

/** One square-ish tile of the Today grid. */
function Tile({ icon, iconColor, value, unit, label, onPress, children, hint }: {
  icon?: IconName; iconColor?: string; value: string; unit?: string; label: string; onPress?: () => void;
  children?: React.ReactNode; hint?: string;
}) {
  const c = useColors();
  const body = (
    <>
      {children ?? (
        <View style={[s.tileIcon, { backgroundColor: c.accentSoft }]}>
          {icon && <Ionicons name={icon} size={17} color={iconColor ?? c.accentText} />}
        </View>
      )}
      <AppText style={s.tileValue} numberOfLines={1}>
        {value}
        {unit ? <AppText style={s.tileUnit} color={c.textMuted}>{` ${unit}`}</AppText> : null}
      </AppText>
      <AppText variant="caption" numberOfLines={2}>{label}</AppText>
    </>
  );
  const style = [s.tile, { backgroundColor: c.surface, borderColor: c.border }];
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityHint={hint} style={({ pressed }) => [style, pressed && s.pressed]}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

/** Today's promise in the day, the check-in in the evening (the journal's daily loop). */
function PromiseTile({ habit, now }: { habit: HabitConfig; now: number }) {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const days = useJournalDays(habit.id);
  const today = days[localDay(now)];
  const evening = new Date(now).getHours() >= EVENING_HOUR;
  const run = pledgeStreak(days, now);
  const promise = habit.pledge?.[lang] ?? t('journal.pledgeFallback');
  const checkIn = () => navigation.navigate('CheckIn', { habitId: habit.id });

  if (evening && today?.checkedAt) {
    return (
      <Tile value={t('journal.checkedIn')} label={today.kept === false ? t('journal.freshStart') : t('journal.seeYouTomorrow')} onPress={checkIn} hint={t('journal.edit')}>
        <AppText style={s.tileEmoji}>{today.mood ? MOODS[today.mood - 1] : '✓'}</AppText>
      </Tile>
    );
  }
  if (evening) return <Tile icon="moon" value={t('journal.checkIn')} label={t('journal.eveningAsk')} onPress={checkIn} />;
  if (today?.pledgedAt) {
    return (
      <Tile
        icon="checkmark"
        iconColor={c.success}
        value={t('journal.promised')}
        label={run > 1 ? t('journal.promiseStreak', { count: run }) : promise}
      />
    );
  }
  return <Tile icon="hand-right" value={t('journal.promise')} label={promise} onPress={() => actions.pledge(habit.id)} />;
}

/** The growing companion (full card on Progress). */
function PlantTile({ now }: { now: number }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { stage, resting } = useCompanion(now);
  return (
    <Tile value={t(`companion.stages.${STAGE_NAMES[stage]}`)} label={t('companion.title')} onPress={() => navigation.navigate('Main', { screen: 'Milestones' })}>
      <View style={s.plant}>
        <Plant stage={stage} resting={resting} size={44} />
      </View>
    </Tile>
  );
}

const s = StyleSheet.create({
  halo: { position: 'absolute', top: 40, left: -80, right: -80, height: 560 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  topActions: { flexDirection: 'row', gap: 10 },
  tagline: { marginTop: 10 },
  hero: { alignItems: 'center', marginTop: 18, gap: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
  chipTrack: { width: 56, height: 6, borderRadius: 3, overflow: 'hidden' },
  chipFill: { height: 6, borderRadius: 3 },
  total: { fontWeight: '600', marginTop: -4 },
  actions: { marginTop: 24, gap: 2 },
  grid: { marginTop: 18, gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, minHeight: 132, borderRadius: radius.lg, borderWidth: 1, padding: 16, gap: 6 },
  pressed: { opacity: 0.85 },
  tileIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tileValue: { fontSize: 19, lineHeight: 26, fontWeight: '700' },
  tileUnit: { fontSize: 13, lineHeight: 26, fontWeight: '500' },
  tileEmoji: { fontSize: 24, lineHeight: 34 },
  plant: { height: 36, marginTop: -6, marginBottom: 2, justifyContent: 'flex-end' },
  card: { marginTop: 16 },
});
