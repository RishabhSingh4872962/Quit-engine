import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HabitConfig } from '../habits/types';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import { EVENING_HOUR, MOODS, pledgeStreak, useJournalDays } from '../lib/journal';
import { localDay } from '../lib/reels';
import { fonts, useColors } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';

/** Home: today's promise during the day, the check-in in the evening; links to the journal. */
export function JournalCard({ habit, now }: { habit: HabitConfig; now: number }) {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const days = useJournalDays(habit.id);
  const today = days[localDay(now)];
  const evening = new Date(now).getHours() >= EVENING_HOUR;
  const run = pledgeStreak(days, now);
  const promise = habit.pledge?.[lang] ?? t('journal.pledgeFallback');
  const openCheckIn = () => navigation.navigate('CheckIn', { habitId: habit.id });

  const state = evening ? (today?.checkedAt ? 'checked' : 'ask') : today?.pledgedAt ? 'promised' : 'promise';

  return (
    <Card style={s.card}>
      <View style={s.top}>
        <AppText variant="label">{evening ? t('journal.eveningLabel') : t('journal.promiseLabel')}</AppText>
        <Pressable
          onPress={() => navigation.navigate('Journal', { habitId: habit.id })}
          hitSlop={10}
          accessibilityRole="button"
          style={s.link}
        >
          <Ionicons name="book-outline" size={15} color={c.accentText} />
          <AppText variant="caption" color={c.accentText} style={s.linkText}>{t('journal.open')}</AppText>
        </Pressable>
      </View>

      <Animated.View key={state} entering={FadeIn.duration(300)} style={s.body}>
        {state === 'promise' && (
          <>
            <AppText style={s.promise}>{promise}</AppText>
            <Button variant="soft" icon="hand-right-outline" label={t('journal.promise')} onPress={() => actions.pledge(habit.id)} />
          </>
        )}
        {state === 'promised' && (
          <View style={s.row}>
            <Ionicons name="checkmark-circle" size={28} color={c.accent} />
            <View style={s.flex}>
              <AppText style={s.promise}>{promise}</AppText>
              <AppText variant="caption">
                {run > 1 ? `${t('journal.promised')} · ${t('journal.promiseStreak', { count: run })}` : t('journal.promised')}
              </AppText>
            </View>
          </View>
        )}
        {state === 'ask' && (
          <>
            <AppText style={s.promise}>{t('journal.eveningAsk')}</AppText>
            <Button variant="soft" icon="moon-outline" label={t('journal.checkIn')} onPress={openCheckIn} />
          </>
        )}
        {state === 'checked' && (
          <Pressable onPress={openCheckIn} style={s.row} accessibilityRole="button" accessibilityHint={t('journal.edit')}>
            {today?.mood ? (
              <AppText style={s.mood}>{MOODS[today.mood - 1]}</AppText>
            ) : (
              <Ionicons name="checkmark-circle" size={28} color={c.accent} />
            )}
            <View style={s.flex}>
              <AppText style={s.promise}>{t('journal.checkedIn')}</AppText>
              <AppText variant="caption">{today?.kept === false ? t('journal.freshStart') : t('journal.seeYouTomorrow')}</AppText>
            </View>
            <AppText variant="caption" color={c.accentText} style={s.linkText}>{t('journal.edit')}</AppText>
          </Pressable>
        )}
      </Animated.View>
    </Card>
  );
}

const s = StyleSheet.create({
  card: { gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { fontWeight: '600' },
  body: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  promise: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 26, includeFontPadding: false },
  mood: { fontSize: 30, lineHeight: 38 },
});
