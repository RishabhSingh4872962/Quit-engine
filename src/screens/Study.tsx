import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import { GOAL_OPTIONS, mySubjects, useFocusPrefs, useStudyLog } from '../lib/focus';
import { formatDuration } from '../lib/format';
import { lastDays } from '../lib/journal';
import { useNow } from '../lib/streak';
import { Subject, SUBJECTS } from '../rooms/data';
import { fonts, radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { IconButton } from '../components/IconButton';
import { ToggleChips } from '../components/Pickers';
import { LIVE } from '../components/RoomCard';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';

type Range = '7' | '30';
const CHART_HEIGHT = 120;

const toDate = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Study time from focus sessions: per day, per subject, against the daily goal. Only on this phone. */
export function StudyScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const prefs = useFocusPrefs();
  const log = useStudyLog();
  const now = useNow();
  const [range, setRange] = useState<Range>('7');
  const n = Number(range);
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const fmt = (min: number) => formatDuration(min * 60_000, t);

  const days = lastDays(n, now);
  const minutes = days.map((d) => log.days[d] ?? 0);
  const total = minutes.reduce((a, b) => a + b, 0);
  const goal = prefs.goal;
  const met = goal ? minutes.filter((m) => m >= goal).length : 0;
  // Goal days in a row up to today (today not met yet doesn't break the run).
  let run = 0;
  if (goal) {
    for (const [i, d] of lastDays(60, now).reverse().entries()) {
      if ((log.days[d] ?? 0) >= goal) run++;
      else if (i > 0) break;
    }
  }
  const top = Math.max(goal, ...minutes, 1);

  const bySubject = new Map<Subject, number>();
  for (const d of days) {
    for (const [sub, m] of Object.entries(log.subjects[d] ?? {}) as [Subject, number][]) {
      bySubject.set(sub, (bySubject.get(sub) ?? 0) + m);
    }
  }
  const subjectRows = [...bySubject.entries()].sort((a, b) => b[1] - a[1]);
  const noSubject = Math.max(0, total - subjectRows.reduce((a, [, m]) => a + m, 0));
  const subjectTop = Math.max(1, noSubject, ...subjectRows.map(([, m]) => m));

  const ranges = [
    { value: '7' as const, label: t('study.days7') },
    { value: '30' as const, label: t('study.days30') },
  ];

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <AppText variant="title" style={s.flex}>{t('study.title')}</AppText>
        <IconButton icon="close" label={t('setup.close')} onPress={navigation.goBack} filled />
      </View>
      <Segmented options={ranges} value={range} onChange={setRange} />

      <Card style={s.card}>
        <AppText style={s.big} color={c.accentText}>{fmt(total)}</AppText>
        {total > 0 ? (
          <AppText variant="muted">{t('study.average', { time: formatDuration((total / n) * 60_000, t) })}</AppText>
        ) : (
          <AppText variant="muted">{t('study.none')}</AppText>
        )}
        {goal > 0 && (
          <AppText variant="muted">
            {t('study.goalDays', { count: met, total: n })}
            {run > 1 ? ` · ${t('study.goalRun', { count: run })}` : ''}
          </AppText>
        )}

        <View style={[s.chart, { height: CHART_HEIGHT }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {goal > 0 && (
            <View style={[s.goalLine, { bottom: (goal / top) * CHART_HEIGHT, borderColor: c.textMuted }]} />
          )}
          {minutes.map((m, i) => (
            <View key={days[i]} style={s.barSlot}>
              <View
                style={[
                  s.bar,
                  {
                    height: Math.max(m ? 4 : 2, (m / top) * CHART_HEIGHT),
                    backgroundColor: m === 0 ? c.surfaceAlt : goal && m >= goal ? LIVE : c.accent,
                  },
                ]}
              />
            </View>
          ))}
        </View>
        {n === 7 && (
          <View style={s.labels}>
            {days.map((d) => (
              <AppText key={d} variant="caption" style={s.label}>
                {toDate(d).toLocaleDateString(locale, { weekday: 'narrow' })}
              </AppText>
            ))}
          </View>
        )}
        {goal > 0 && <AppText variant="caption">{t('study.goalLine', { time: fmt(goal) })}</AppText>}
      </Card>

      {total > 0 && (
        <Card style={s.card}>
          <AppText variant="heading">{t('study.bySubject')}</AppText>
          {[...subjectRows, ...(noSubject ? [['none', noSubject] as const] : [])].map(([sub, m]) => (
            <View key={sub} style={s.subjectRow}>
              <View style={s.subjectTop}>
                <AppText style={s.subjectName}>{sub === 'none' ? t('study.noSubject') : t(`focus.subjectNames.${sub}`)}</AppText>
                <AppText variant="caption">{`${fmt(m)} · ${Math.round((m / total) * 100)}%`}</AppText>
              </View>
              <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
                <View style={[s.fill, { width: `${(m / subjectTop) * 100}%`, backgroundColor: sub === 'none' ? c.textMuted : c.accent }]} />
              </View>
            </View>
          ))}
        </Card>
      )}

      <Card style={s.card}>
        <AppText variant="heading">{t('study.goalTitle')}</AppText>
        <Segmented
          options={GOAL_OPTIONS.map((g) => ({ value: String(g), label: g ? t('study.hours', { count: g / 60 }) : t('study.goalOff') }))}
          value={String(goal)}
          onChange={(v) => actions.setFocusPrefs({ goal: Number(v) })}
        />
        <AppText variant="caption">{t('study.goalSub')}</AppText>
      </Card>

      <Card style={s.card}>
        <AppText variant="heading">{t('study.subjectsTitle')}</AppText>
        <AppText variant="caption">{t('study.subjectsSub')}</AppText>
        <ToggleChips
          options={SUBJECTS.map((id) => ({ id, label: t(`focus.subjectNames.${id}`) }))}
          value={prefs.subjects}
          onChange={(subjects) => {
            // A picked subject that is no longer offered is cleared.
            const keep = prefs.subject && mySubjects({ ...prefs, subjects }).includes(prefs.subject);
            actions.setFocusPrefs({ subjects, ...(keep ? {} : { subject: undefined }) });
          }}
        />
        <AppText variant="caption">{t('study.roomsNote')}</AppText>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  card: { gap: 10, marginTop: 14 },
  big: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 40, includeFontPadding: false },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 8 },
  goalLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '70%', borderRadius: 4 },
  labels: { flexDirection: 'row', gap: 3 },
  label: { flex: 1, textAlign: 'center' },
  subjectRow: { gap: 6 },
  subjectTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectName: { fontWeight: '600' },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
});
