import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HABIT_LIST } from '../habits';
import { useLang } from '../i18n';
import { formatDuration } from '../lib/format';
import { dayTotals, ReelDay, useReelCounter, useReelLimit } from '../lib/reels';
import { readState, useTracked } from '../lib/storage';
import { fonts, radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';

type Range = '7' | '30';
const LATE_HOURS = [23, 0, 1, 2, 3, 4]; // 11 PM – 5 AM
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Reels history: per day, per app, time of day, and time won back. Opened from Home and the weekly summary. */
export function ReelStatsScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const tracked = useTracked();
  const limit = useReelLimit();
  const [range, setRange] = useState<Range>('7');
  const { stats } = useReelCounter(60);

  const habit = HABIT_LIST.find((h) => h.reelApps && tracked.includes(h.id)) ?? HABIT_LIST.find((h) => h.reelApps);
  const apps = habit?.reelApps ?? [];
  const ids = apps.map((a) => a.id);
  const n = Number(range);

  // Only days since counting began count towards averages and comparisons.
  const firstDay = stats.find((d) => dayTotals(d, ids).count > 0)?.day;
  const days = stats.slice(-n);
  const counted = days.filter((d) => firstDay !== undefined && d.day >= firstDay);
  const prev = stats.slice(-2 * n, -n);
  const prevComplete = firstDay !== undefined && prev.length === n && prev[0].day >= firstDay;

  const totals = days.map((d) => dayTotals(d, ids));
  const total = sum(totals.map((x) => x.count));
  const totalMs = sum(totals.map((x) => x.ms));
  const avgCount = counted.length ? Math.round(total / counted.length) : 0;
  const avgMs = counted.length ? totalMs / counted.length : 0;
  const prevTotal = sum(prev.map((d) => dayTotals(d, ids).count));
  const change = prevComplete && prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  const hours = Array.from({ length: 24 }, (_, h) => sum(days.map((d) => d.hours?.[h] ?? 0)));
  const late = sum(LATE_HOURS.map((h) => hours[h]));

  // Time won back: the old daily scrolling time from the quiz, minus today's average in reels.
  const base = habit?.reelBaseline;
  const answer = base && habit ? readState(habit.id).quizAnswers[base.quizId] : undefined;
  const baseMinutes = base && answer !== undefined ? base.minutes[answer] : undefined;
  const startLabel = habit && base && answer !== undefined
    ? habit.quiz.find((q) => q.id === base.quizId)?.options[answer]?.[lang]
    : undefined;
  const wonBackMs = baseMinutes !== undefined && counted.length ? baseMinutes * 60_000 - avgMs : 0;

  const period = range === '7' ? t('reelStats.periodWeek') : t('reelStats.periodMonth');
  const ranges = [
    { value: '7' as const, label: t('reelStats.days7') },
    { value: '30' as const, label: t('reelStats.days30') },
  ];

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <AppText variant="title">{t('reelStats.title')}</AppText>
        <IconButton icon="close" label={t('setup.close')} onPress={navigation.goBack} filled />
      </View>
      <Segmented options={ranges} value={range} onChange={setRange} />

      <Card style={s.card}>
        <AppText style={s.big} color={c.accentText}>{t('reels.count', { count: total })}</AppText>
        {total > 0 ? (
          <AppText variant="muted">
            {t('reelStats.average', { count: avgCount, time: formatDuration(avgMs, t) })}
          </AppText>
        ) : (
          <AppText variant="muted">{t('reelStats.none')}</AppText>
        )}
        {change !== null && (
          <AppText style={s.change} color={change <= 0 ? c.accentText : c.textMuted}>
            {change < 0
              ? t('reelStats.fewer', { pct: -change, period })
              : change > 0
                ? t('reelStats.more', { pct: change, period })
                : t('reelStats.same', { period })}
          </AppText>
        )}
        <DayBars days={days} ids={ids} limit={limit} labels={range === '7'} />
      </Card>

      {wonBackMs > 60_000 && startLabel && (
        <Card style={s.card}>
          <AppText variant="label">{t('reelStats.wonBackTitle')}</AppText>
          <AppText style={s.mid} color={c.accentText}>{formatDuration(wonBackMs, t)}</AppText>
          <AppText variant="muted">{t('reelStats.wonBack', { start: startLabel })}</AppText>
        </Card>
      )}

      {total > 0 && (
        <Card style={s.card}>
          <AppText variant="label">{t('reelStats.byApp')}</AppText>
          {apps.map((a) => {
            const count = sum(days.map((d) => d.apps[a.id]?.count ?? 0));
            const ms = sum(days.map((d) => d.apps[a.id]?.ms ?? 0));
            if (!count) return null;
            return (
              <View key={a.id} style={s.appRow}>
                <AppText style={s.appName}>{a.name}</AppText>
                <AppText variant="muted">{t('reels.appLine', { count, time: formatDuration(ms, t) })}</AppText>
              </View>
            );
          })}
        </Card>
      )}

      {total > 0 && (
        <Card style={s.card}>
          <AppText variant="label">{t('reelStats.when')}</AppText>
          <HourBars hours={hours} />
          <AppText variant="caption">
            {late > 0 ? t('reelStats.late', { count: late }) : t('reelStats.noLate')}
          </AppText>
        </Card>
      )}
    </Screen>
  );
}

/** Reels per day; days over the limit in a muted colour, with a line at the limit. */
function DayBars({ days, ids, limit, labels }: { days: ReelDay[]; ids: string[]; limit: number; labels: boolean }) {
  const c = useColors();
  const lang = useLang();
  const counts = days.map((d) => dayTotals(d, ids).count);
  const max = Math.max(limit, ...counts, 1);
  const today = days.length - 1;
  return (
    <View>
      <View style={s.chart}>
        {limit > 0 && <View style={[s.limitLine, { bottom: `${(limit / max) * 100}%`, borderColor: c.textMuted }]} />}
        {counts.map((n, i) => (
          <View key={days[i].day} style={s.column}>
            <View
              style={[
                s.bar,
                {
                  height: `${Math.max(2, (n / max) * 100)}%`,
                  backgroundColor: limit > 0 && n > limit ? c.textMuted : i === today ? c.accent : c.accentSoft,
                },
              ]}
            />
          </View>
        ))}
      </View>
      {labels && (
        <View style={s.labels}>
          {days.map((d, i) => {
            const [y, m, day] = d.day.split('-').map(Number);
            return (
              <AppText key={d.day} variant="caption" center style={s.flex} color={i === today ? c.accentText : undefined}>
                {new Date(y, m - 1, day).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'narrow' })}
              </AppText>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Reels by hour of day (midnight to midnight); late-night hours highlighted. */
function HourBars({ hours }: { hours: number[] }) {
  const c = useColors();
  const max = Math.max(...hours, 1);
  return (
    <View>
      <View style={[s.chart, s.hourChart]}>
        {hours.map((n, h) => (
          <View key={h} style={s.column}>
            <View
              style={[
                s.bar,
                { height: `${Math.max(2, (n / max) * 100)}%`, backgroundColor: LATE_HOURS.includes(h) ? c.accent : c.accentSoft },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={s.hourLabels}>
        {['12a', '6a', '12p', '6p', '12a'].map((l, i) => (
          <AppText key={i} variant="caption">{l}</AppText>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  card: { gap: 10, marginTop: 14 },
  big: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 44, includeFontPadding: false },
  mid: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, includeFontPadding: false },
  change: { fontWeight: '600' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 110, marginTop: 6 },
  hourChart: { height: 70, gap: 2 },
  column: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: radius.sm / 2 },
  limitLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  labels: { flexDirection: 'row', gap: 3, marginTop: 6 },
  hourLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  appRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appName: { fontSize: 16, fontWeight: '600' },
});
