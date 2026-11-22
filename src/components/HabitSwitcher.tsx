import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HABIT_LIST, HABITS } from '../habits';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import { useActiveHabitId, useTracked } from '../lib/storage';
import { makePalette, radius, useColors } from '../theme';

/** Chips for each tracked habit (each in its own colour), plus "+" to add another. */
export function HabitSwitcher() {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const tracked = useTracked();
  const activeId = useActiveHabitId();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      accessibilityRole="tablist"
    >
      {tracked.map((id) => {
        const habit = HABITS[id];
        const h = makePalette(habit.accent, c.scheme);
        const active = id === activeId;
        return (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              void Haptics.selectionAsync();
              actions.setActive(id);
            }}
            style={[s.chip, { backgroundColor: active ? h.accent : c.surface, borderColor: active ? h.accent : c.border }]}
          >
            <Ionicons name={habit.icon} size={16} color={active ? h.onAccent : h.accentText} />
            <Text style={[s.label, { color: active ? h.onAccent : c.text }]}>{habit.name[lang]}</Text>
          </Pressable>
        );
      })}
      {tracked.length < HABIT_LIST.length && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.addHabit')}
          onPress={() => navigation.navigate('AddHabit')}
          style={[s.chip, s.add, { borderColor: c.border }]}
        >
          <Ionicons name="add" size={18} color={c.textMuted} />
        </Pressable>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { gap: 8, paddingBottom: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  add: { borderStyle: 'dashed', paddingHorizontal: 11 },
  label: { fontSize: 14, fontWeight: '700' },
});
