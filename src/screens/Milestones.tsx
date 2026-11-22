import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { ACTIVE_HABIT as habit } from '../habits';
import { milestoneLabel, useLang } from '../i18n';
import { useHabitState } from '../lib/storage';
import { DAY_MS, milestoneProgress, useNow } from '../lib/streak';
import { radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';

type Status = 'reached' | 'next' | 'locked';

export function MilestonesScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const { streakStart } = useHabitState();
  const now = useNow();
  const { days, next, prev, progress } = milestoneProgress(streakStart, habit.milestones, now);
  const started = streakStart !== null;

  const statusOf = (m: number): Status => (!started ? 'locked' : m <= days ? 'reached' : m === next ? 'next' : 'locked');
  const reached = habit.milestones.filter((m) => statusOf(m) === 'reached').length;
  const date = new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' });

  return (
    <Screen scroll>
      <AppText variant="title">{t('milestones.title')}</AppText>
      <AppText variant="muted" style={s.summary}>
        {t('milestones.summary', { reached, total: habit.milestones.length })}
      </AppText>

      {habit.milestones.map((m, i) => {
        const status = statusOf(m);
        const last = i === habit.milestones.length - 1;
        const lineColor = status === 'reached' && statusOf(habit.milestones[i + 1]) !== 'locked' ? c.accent : c.border;

        return (
          <Animated.View key={m} entering={FadeInDown.delay(i * 50).duration(400)} style={s.row}>
            <View style={s.rail}>
              <Node status={status} />
              {!last && <View style={[s.line, { backgroundColor: lineColor }]} />}
            </View>

            <Card style={[s.card, status === 'next' && { borderColor: c.accent, borderWidth: 1.5 }]}>
              <AppText variant="heading" color={status === 'locked' ? c.textMuted : c.text}>
                {milestoneLabel(m, t)}
              </AppText>
              {status === 'reached' && streakStart !== null && (
                <AppText variant="caption">{t('milestones.reachedOn', { date: date.format(streakStart + m * DAY_MS) })}</AppText>
              )}
              {status === 'next' && (
                <>
                  <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
                    <View style={[s.fill, { backgroundColor: c.accent, width: `${(m === next ? progress : 0) * 100}%` }]} />
                  </View>
                  <AppText variant="caption">{t('milestones.toGo', { count: m - days })}</AppText>
                </>
              )}
              {status === 'locked' && (
                <AppText variant="caption">
                  {started ? t('milestones.inDays', { count: m - Math.max(days, prev) }) : t('milestones.startFirst')}
                </AppText>
              )}
            </Card>
          </Animated.View>
        );
      })}
    </Screen>
  );
}

function Node({ status }: { status: Status }) {
  const c = useColors();
  if (status === 'reached') {
    return (
      <View style={[s.node, { backgroundColor: c.accent }]}>
        <Ionicons name="checkmark" size={18} color={c.onAccent} />
      </View>
    );
  }
  if (status === 'next') {
    return (
      <View style={[s.node, { backgroundColor: c.accentSoft, borderColor: c.accent, borderWidth: 2 }]}>
        <View style={[s.pulse, { backgroundColor: c.accent }]} />
      </View>
    );
  }
  return (
    <View style={[s.node, { backgroundColor: c.surfaceAlt }]}>
      <Ionicons name="lock-closed" size={14} color={c.textMuted} />
    </View>
  );
}

const NODE = 34;
const s = StyleSheet.create({
  summary: { marginBottom: 24 },
  row: { flexDirection: 'row', gap: 14 },
  rail: { width: NODE, alignItems: 'center' },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  pulse: { width: 12, height: 12, borderRadius: 6 },
  line: { flex: 1, width: 3, borderRadius: 2, marginVertical: 4 },
  card: { flex: 1, marginBottom: 12, gap: 6 },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: radius.pill },
});
