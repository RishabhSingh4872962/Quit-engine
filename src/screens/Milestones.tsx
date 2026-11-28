import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { milestoneLabel, useLang } from '../i18n';
import { actions } from '../lib/actions';
import { useActiveHabit, useHabitState } from '../lib/storage';
import { DAY_MS, milestoneProgress, useNow } from '../lib/streak';
import { STAGE_NAMES, STAGES, useCompanion } from '../lib/companion';
import { radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Plant } from '../components/Plant';
import { Screen } from '../components/Screen';

type Status = 'reached' | 'next' | 'locked';

/** The Progress tab: the next milestone, the plant, and every milestone on one timeline. */
export function MilestonesScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const habit = useActiveHabit();
  const { streakStart } = useHabitState(habit.id);
  const now = useNow();
  const { days, next, prev, progress } = milestoneProgress(streakStart, habit.milestones, now);
  const started = streakStart !== null;

  const statusOf = (m: number | undefined): Status =>
    m === undefined || !started ? 'locked' : m <= days ? 'reached' : m === next ? 'next' : 'locked';
  const reached = habit.milestones.filter((m) => statusOf(m) === 'reached').length;
  const date = new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' });

  return (
    <Screen scroll>
      <AppText variant="title">{t('milestones.title')}</AppText>
      <AppText variant="muted" style={s.summary}>
        {habit.name[lang]} · {t('milestones.summary', { reached, total: habit.milestones.length })}
      </AppText>

      <Animated.View entering={FadeInDown.duration(400)}>
        <Card style={s.next}>
          {!started ? (
            <>
              <AppText variant="label">{t('milestones.next')}</AppText>
              <AppText variant="heading">{milestoneLabel(habit.milestones[0], t)}</AppText>
              <AppText variant="caption">{t('milestones.startFirst')}</AppText>
              <Button icon="play" label={t('home.startStreak')} onPress={() => void actions.startStreak(habit.id)} style={s.start} />
            </>
          ) : next !== undefined ? (
            <>
              <AppText variant="label">{t('milestones.next')}</AppText>
              <View style={s.nextHead}>
                <AppText style={s.nextName}>{milestoneLabel(next, t)}</AppText>
                <AppText style={s.percent} color={c.accentText}>{`${Math.round(progress * 100)}%`}</AppText>
              </View>
              <View style={[s.track, { backgroundColor: c.surfaceHigh }]}>
                <View
                  style={[
                    s.fill,
                    {
                      width: `${Math.max(progress, 0.03) * 100}%`,
                      backgroundColor: c.accent,
                      backgroundImage: `linear-gradient(90deg, ${c.accentLight}, ${c.accent})`,
                    },
                  ]}
                />
              </View>
              <AppText variant="caption">
                {t('milestones.toGo', { count: next - days })} · {t('milestones.around', { date: date.format(streakStart + next * DAY_MS) })}
              </AppText>
            </>
          ) : (
            <View style={s.allDone}>
              <Ionicons name="trophy" size={22} color={c.accentText} />
              <AppText variant="heading" style={s.flex}>{t('home.allMilestones')}</AppText>
            </View>
          )}
        </Card>
      </Animated.View>

      <CompanionCard now={now} />

      <AppText variant="label" style={s.listLabel}>{t('milestones.list')}</AppText>
      <Animated.View entering={FadeInDown.delay(120).duration(400)}>
        <Card style={s.list}>
          {habit.milestones.map((m, i) => {
            const status = statusOf(m);
            const first = i === 0;
            const last = i === habit.milestones.length - 1;
            const lit = (st: Status) => (st === 'locked' ? c.border : c.accent);
            return (
              <View key={m} style={s.row}>
                <View style={s.rail}>
                  {!first && <View style={[s.line, s.lineTop, { backgroundColor: lit(status) }]} />}
                  {!last && <View style={[s.line, s.lineBottom, { backgroundColor: lit(statusOf(habit.milestones[i + 1])) }]} />}
                  <Node status={status} />
                </View>
                <View style={s.rowText}>
                  <AppText style={s.rowTitle} color={status === 'locked' ? c.textMuted : c.text}>{milestoneLabel(m, t)}</AppText>
                  {status === 'reached' && streakStart !== null && (
                    <AppText variant="caption">{t('milestones.reachedOn', { date: date.format(streakStart + m * DAY_MS) })}</AppText>
                  )}
                  {status === 'next' && (
                    <AppText variant="caption" color={c.accentText}>{t('milestones.toGo', { count: m - days })}</AppText>
                  )}
                  {status === 'locked' && started && (
                    <AppText variant="caption">{t('milestones.inDays', { count: m - Math.max(days, prev) })}</AppText>
                  )}
                </View>
              </View>
            );
          })}
        </Card>
      </Animated.View>
    </Screen>
  );
}

const NODE = 28;

function Node({ status }: { status: Status }) {
  const c = useColors();
  if (status === 'reached') {
    return (
      <View style={[s.node, { backgroundColor: c.accent }]}>
        <Ionicons name="checkmark" size={16} color={c.onAccent} />
      </View>
    );
  }
  if (status === 'next') {
    return (
      <View style={[s.node, { backgroundColor: c.surface, borderColor: c.accent, borderWidth: 2, boxShadow: `0px 0px 14px ${c.glow}` }]}>
        <View style={[s.dot, { backgroundColor: c.accent }]} />
      </View>
    );
  }
  return (
    <View style={[s.node, { backgroundColor: c.surface }]}>
      <View style={[s.dot, { backgroundColor: c.surfaceHigh }]} />
    </View>
  );
}

/** The growing companion: one plant for the whole app (see src/lib/companion.ts). */
function CompanionCard({ now }: { now: number }) {
  const { t } = useTranslation();
  const c = useColors();
  const { points, stage, next, progress, resting } = useCompanion(now);
  return (
    <Animated.View entering={FadeInDown.delay(60).duration(400)}>
      <Card style={s.companion}>
        <Plant stage={stage} resting={resting} size={110} />
        <View style={s.companionText}>
          <AppText variant="label">{t('companion.title')}</AppText>
          <AppText style={s.companionStage} color={c.accentText}>{t(`companion.stages.${STAGE_NAMES[stage]}`)}</AppText>
          <AppText variant="caption">{resting ? t('companion.resting') : t('companion.growing')}</AppText>
          {next !== undefined ? (
            <>
              <View style={[s.track, s.plantTrack, { backgroundColor: c.surfaceHigh }]}>
                <View style={[s.fill, { backgroundColor: c.accent, width: `${Math.min(1, progress) * 100}%` }]} />
              </View>
              <AppText variant="caption">
                {t('companion.next', { points: points - STAGES[stage], need: next - STAGES[stage], stage: t(`companion.stages.${STAGE_NAMES[stage + 1]}`) })}
              </AppText>
            </>
          ) : (
            <AppText variant="caption">{t('companion.full')}</AppText>
          )}
        </View>
      </Card>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  summary: { marginBottom: 20 },
  next: { gap: 8, marginBottom: 14 },
  nextHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  nextName: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  percent: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  start: { marginTop: 8 },
  allDone: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  companion: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  companionText: { flex: 1, gap: 4 },
  companionStage: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  plantTrack: { marginTop: 4 },
  fill: { height: '100%', borderRadius: radius.pill },
  listLabel: { marginLeft: 4, marginBottom: 8 },
  list: { paddingVertical: 6, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 14, minHeight: 64 },
  rail: { width: NODE, alignItems: 'center', justifyContent: 'center' },
  line: { position: 'absolute', width: 2, borderRadius: 1 },
  lineTop: { top: 0, height: '50%' },
  lineBottom: { bottom: 0, height: '50%' },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowText: { flex: 1, justifyContent: 'center', gap: 1, paddingVertical: 10 },
  rowTitle: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
});
