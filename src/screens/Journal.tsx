import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { StaticScreenProps, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HABITS } from '../habits';
import { HabitId } from '../habits/types';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import { mix } from '../lib/color';
import {
  checkInDay,
  DAY_PARTS,
  DayEntry,
  journalInsights,
  lastDays,
  MOOD_NAMES,
  MOODS,
  pledgeStreak,
  triggerOptions,
  useJournalDays,
  useUrges,
} from '../lib/journal';
import { localDay } from '../lib/reels';
import { useNow } from '../lib/streak';
import { fonts, radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';

type Props = StaticScreenProps<{ habitId: HabitId }>;
type Range = '7' | '30';

const toDate = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Urge diary patterns, promises, moods and notes for one habit. Only on this phone. */
export function JournalScreen({ route }: Props) {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const habit = HABITS[route.params.habitId];
  const urges = useUrges(habit.id);
  const days = useJournalDays(habit.id);
  const now = useNow();
  const [range, setRange] = useState<Range>('7');
  const n = Number(range);
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';

  const x = journalInsights(urges, days, n, now);
  const labels = new Map<string, string>(triggerOptions(habit, lang, t).map((o) => [o.id, o.label]));
  const run = pledgeStreak(days, now);
  const checkedToday = days[checkInDay(now)]?.checkedAt !== undefined;
  const maxPart = Math.max(1, ...DAY_PARTS.map((p) => x.parts[p]));
  const barColor = mix(c.accent, c.surfaceAlt, 0.45); // the busiest part of the day gets the full accent
  const fmt = (v: number) => v.toFixed(1);
  const strengthLine =
    x.strength === undefined
      ? null
      : x.prevStrength !== undefined && x.strength <= x.prevStrength - 0.3
        ? t('journal.lighter', { prev: fmt(x.prevStrength), now: fmt(x.strength) })
        : x.prevStrength !== undefined && x.strength >= x.prevStrength + 0.3
          ? t('journal.stronger', { prev: fmt(x.prevStrength), now: fmt(x.strength) })
          : t('journal.strengthAvg', { now: fmt(x.strength) });

  // Day by day, newest first: only days with something in them.
  const perDay = new Map<string, number>();
  for (const u of urges) perDay.set(localDay(u.at), (perDay.get(localDay(u.at)) ?? 0) + 1);
  const recent = lastDays(n, now)
    .reverse()
    .filter((d) => days[d]?.checkedAt || days[d]?.pledgedAt || perDay.has(d));
  const hasData = urges.length > 0 || Object.keys(days).length > 0;

  const confirmClear = () =>
    Alert.alert(t('journal.clearTitle'), t('journal.clearBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('journal.clearConfirm'), style: 'destructive', onPress: () => actions.clearJournal(habit.id) },
    ]);

  const ranges = [
    { value: '7' as const, label: t('journal.days7') },
    { value: '30' as const, label: t('journal.days30') },
  ];

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <View style={s.flex}>
          <AppText variant="title">{t('journal.title')}</AppText>
          <AppText variant="muted">{habit.name[lang]}</AppText>
        </View>
        <IconButton icon="close" label={t('setup.close')} onPress={navigation.goBack} filled />
      </View>
      <Segmented options={ranges} value={range} onChange={setRange} />

      {!checkedToday && (
        <Button
          variant="soft"
          icon="moon-outline"
          label={t('journal.checkInNow')}
          onPress={() => navigation.navigate('CheckIn', { habitId: habit.id })}
          style={s.checkIn}
        />
      )}

      <Card style={s.card}>
        <AppText variant="label">{t('journal.urgesTitle')}</AppText>
        <AppText style={s.big} color={c.accentText}>{t('journal.urgesNoted', { count: x.urges })}</AppText>
        {x.urges === 0 ? (
          <AppText variant="muted">{t('journal.noUrges')}</AppText>
        ) : (
          <>
            {strengthLine && <AppText variant="muted">{strengthLine}</AppText>}
            <AppText variant="heading" style={s.sub}>{t('journal.whenTitle')}</AppText>
            {x.peak && (
              <AppText variant="muted">
                {t('journal.peak', { part: t(`journal.parts.${x.peak}`), hours: t(`journal.partHours.${x.peak}`) })}
              </AppText>
            )}
            {DAY_PARTS.map((p) => (
              <View key={p} style={s.barRow} accessible accessibilityLabel={`${t(`journal.parts.${p}`)}: ${x.parts[p]}`}>
                <View style={s.barLabel}>
                  <AppText style={s.partName}>{t(`journal.parts.${p}`)}</AppText>
                  <AppText variant="caption">{t(`journal.partHours.${p}`)}</AppText>
                </View>
                <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
                  <View
                    style={[
                      s.fill,
                      { width: `${(x.parts[p] / maxPart) * 100}%`, backgroundColor: p === x.peak ? c.accent : barColor },
                    ]}
                  />
                </View>
                <AppText style={s.barCount}>{x.parts[p]}</AppText>
              </View>
            ))}
            {x.triggers.length > 0 && (
              <>
                <AppText variant="heading" style={s.sub}>{t('journal.triggersTitle')}</AppText>
                {x.triggers.map((tr) => (
                  <View key={tr.id} style={s.triggerRow}>
                    <AppText style={s.flex}>{labels.get(tr.id) ?? t('journal.otherTrigger')}</AppText>
                    <AppText variant="muted">{t('journal.times', { count: tr.count })}</AppText>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </Card>

      <Card style={s.card}>
        <AppText variant="label">{t('journal.promiseTitle')}</AppText>
        <AppText style={s.promise}>{habit.pledge?.[lang] ?? t('journal.pledgeFallback')}</AppText>
        <AppText variant="muted">{run > 0 ? t('journal.promiseStreak', { count: run }) : t('journal.noPromiseYet')}</AppText>
        {x.checkIns > 0 && <AppText variant="muted">{t('journal.keptDays', { kept: x.kept, count: x.checkIns })}</AppText>}
        <AppText variant="heading" style={s.sub}>{t('journal.moodTitle')}</AppText>
        <View style={s.moodRow}>
          {lastDays(7, now).map((d) => {
            const mood = days[d]?.mood;
            const date = toDate(d);
            return (
              <View
                key={d}
                style={s.moodDay}
                accessible
                accessibilityLabel={`${date.toLocaleDateString(locale, { weekday: 'long' })}: ${
                  mood ? t(`journal.moods.${MOOD_NAMES[mood - 1]}`) : t('journal.noMood')
                }`}
              >
                <View style={[s.moodDot, { backgroundColor: mood ? c.accentSoft : c.surfaceAlt }]}>
                  <AppText style={mood ? s.moodEmoji : s.noMood} color={c.textMuted}>{mood ? MOODS[mood - 1] : '·'}</AppText>
                </View>
                <AppText variant="caption">{date.toLocaleDateString(locale, { weekday: 'narrow' })}</AppText>
              </View>
            );
          })}
        </View>
      </Card>

      {recent.length > 0 && (
        <Card style={s.card}>
          <AppText variant="label">{t('journal.recentTitle')}</AppText>
          {recent.map((d, i) => (
            <DayRow key={d} day={d} entry={days[d]} urges={perDay.get(d) ?? 0} locale={locale} first={i === 0} />
          ))}
        </Card>
      )}

      <AppText variant="caption" center style={s.private}>{t('journal.private')}</AppText>
      {hasData && <Button variant="ghost" label={t('journal.clear')} onPress={confirmClear} />}
    </Screen>
  );
}

function DayRow({ day, entry, urges, locale, first }: {
  day: string; entry?: DayEntry; urges: number; locale: string; first: boolean;
}) {
  const { t } = useTranslation();
  const c = useColors();
  const status =
    entry?.kept === true
      ? t('journal.keptShort')
      : entry?.kept === false
        ? t('journal.notFully')
        : entry?.pledgedAt
          ? t('journal.promised')
          : null;
  const line = [status, urges ? t('journal.dayUrges', { count: urges }) : null].filter(Boolean).join(' · ');
  return (
    <View style={[s.dayRow, !first && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={s.dayTop}>
        <AppText style={s.dayDate}>
          {toDate(day).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
        </AppText>
        {entry?.mood ? <AppText style={s.dayMood}>{MOODS[entry.mood - 1]}</AppText> : null}
      </View>
      {line ? <AppText variant="caption">{line}</AppText> : null}
      {entry?.note ? <AppText variant="muted" style={s.note}>{entry.note}</AppText> : null}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  checkIn: { marginTop: 14 },
  card: { gap: 8, marginTop: 14 },
  big: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, includeFontPadding: false },
  sub: { marginTop: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 112 },
  partName: { fontWeight: '600' },
  track: { flex: 1, height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 10, borderRadius: radius.pill },
  barCount: { width: 28, textAlign: 'right', fontWeight: '600' },
  triggerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promise: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 26, includeFontPadding: false },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  moodDay: { alignItems: 'center', gap: 4 },
  moodDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  moodEmoji: { fontSize: 22, lineHeight: 30 },
  noMood: { fontSize: 22, lineHeight: 26 },
  dayRow: { paddingVertical: 10, gap: 2 },
  dayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayDate: { fontWeight: '600' },
  dayMood: { fontSize: 20, lineHeight: 28 },
  note: { marginTop: 2 },
  private: { marginTop: 18, marginBottom: 4 },
});
