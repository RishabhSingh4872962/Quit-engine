import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { HabitConfig } from '../habits/types';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import { useDailySpend, useHabitState } from '../lib/storage';
import { streakDays } from '../lib/streak';
import { fonts, radius, useColors } from '../theme';
import { AppText } from './AppText';
import { TextField } from './TextField';
import { Button } from './Button';
import { Card } from './Card';
import { ChoiceChips } from './Pickers';

/**
 * Money saved (habits with `savings`, e.g. nicotine): days free in total × what it cost a day.
 * Only on this phone; a slip never takes money away (the days still count).
 */
export function MoneyCard({ habit, now }: { habit: HabitConfig; now: number }) {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const state = useHabitState(habit.id);
  const spend = useDailySpend(habit.id);
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState('');
  const money = new Intl.NumberFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const daysFree = state.pastDaysFree + streakDays(state.streakStart, now);

  const save = (rupees: number) => {
    if (!(rupees > 0 && rupees <= 100_000)) return;
    actions.setDailySpend(habit.id, Math.round(rupees));
    setEditing(false);
    setCustom('');
  };

  if (!spend || editing) {
    const suggestions = habit.savings?.suggestions ?? [];
    return (
      <Card style={s.card}>
        <View style={s.top}>
          <View style={[s.icon, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="wallet-outline" size={18} color={c.accent} />
          </View>
          <AppText variant="heading" style={s.flex}>{t('money.title')}</AppText>
        </View>
        <AppText variant="muted">{t('money.ask')}</AppText>
        <ChoiceChips
          options={suggestions.map((n) => ({ id: String(n), label: money.format(n) }))}
          value={spend && suggestions.includes(spend) ? String(spend) : undefined}
          onChange={(v) => v && save(Number(v))}
          clearable={false}
        />
        <View style={s.row}>
          <TextField
            value={custom}
            onChangeText={(v) => setCustom(v.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder={t('money.custom')}
            placeholderTextColor={c.textMuted}
            keyboardType="number-pad"
            style={s.input}
            accessibilityLabel={t('money.custom')}
          />
          <Button variant="soft" label={t('money.save')} onPress={() => save(Number(custom))} disabled={!(Number(custom) > 0)} />
        </View>
        <AppText variant="caption">{t('money.private')}</AppText>
      </Card>
    );
  }

  return (
    <Card style={s.card}>
      <View style={s.top}>
        <View style={[s.icon, { backgroundColor: c.accentSoft }]}>
          <Ionicons name="wallet-outline" size={18} color={c.accent} />
        </View>
        <AppText variant="heading" style={s.flex}>{t('money.title')}</AppText>
        <Pressable onPress={() => setEditing(true)} hitSlop={10} accessibilityRole="button">
          <AppText variant="caption" color={c.accentText} style={s.change}>{t('money.change')}</AppText>
        </Pressable>
      </View>
      <AppText style={s.big} color={c.accentText}>{money.format(daysFree * spend)}</AppText>
      <AppText variant="caption">
        {daysFree > 0 ? t('money.line', { perDay: money.format(spend), count: daysFree }) : t('money.first', { perDay: money.format(spend) })}
      </AppText>
      <AppText variant="caption">{t('money.month', { amount: money.format(spend * 30) })}</AppText>
    </Card>
  );
}

const s = StyleSheet.create({
  card: { gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  change: { fontWeight: '600' },
  big: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 42, includeFontPadding: false },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 },
});
