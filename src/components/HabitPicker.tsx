import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { HABIT_LIST, HABITS } from '../habits';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import { useActiveHabitId, useTracked } from '../lib/storage';
import { makePalette, radius, useColors } from '../theme';
import { AppText } from './AppText';

/**
 * The current habit as a pill (Home's top-left). Tapping it opens a sheet to switch habit or add one,
 * so Home doesn't need a row of chips.
 */
export function HabitPicker() {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tracked = useTracked();
  const activeId = useActiveHabitId();
  const [open, setOpen] = useState(false);
  const active = activeId ? HABITS[activeId] : undefined;
  if (!active) return null;

  const pick = (id: typeof tracked[number]) => {
    setOpen(false);
    if (id === activeId) return;
    void Haptics.selectionAsync();
    actions.setActive(id);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${active.name[lang]}. ${t('home.switchHabit')}`}
        style={({ pressed }) => [s.pill, { backgroundColor: c.surfaceAlt, borderColor: c.border }, pressed && s.pressed]}
      >
        <Ionicons name={active.icon} size={17} color={c.accentText} />
        <AppText style={s.pillText}>{active.name[lang]}</AppText>
        {tracked.length > 1 || tracked.length < HABIT_LIST.length ? <Ionicons name="chevron-down" size={16} color={c.textMuted} /> : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} accessibilityLabel={t('setup.close')} />
        <View style={[s.sheet, { backgroundColor: c.surface, borderColor: c.border, paddingBottom: insets.bottom + 16 }]}>
          <View style={[s.grabber, { backgroundColor: c.surfaceHigh }]} />
          <AppText variant="label" style={s.sheetTitle}>{t('settings.habits')}</AppText>
          {tracked.map((id) => {
            const habit = HABITS[id];
            const h = makePalette(habit.accent);
            const on = id === activeId;
            return (
              <Pressable
                key={id}
                onPress={() => pick(id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [s.row, (on || pressed) && { backgroundColor: c.surfaceAlt }]}
              >
                <View style={[s.icon, { backgroundColor: h.accentSoft }]}>
                  <Ionicons name={habit.icon} size={20} color={h.accentText} />
                </View>
                <View style={s.flex}>
                  <AppText style={s.rowTitle}>{habit.name[lang]}</AppText>
                  <AppText variant="caption" numberOfLines={1}>{habit.tagline[lang]}</AppText>
                </View>
                {on && <Ionicons name="checkmark-circle" size={22} color={h.accentText} />}
              </Pressable>
            );
          })}
          {tracked.length < HABIT_LIST.length && (
            <Pressable
              onPress={() => {
                setOpen(false);
                navigation.navigate('AddHabit');
              }}
              accessibilityRole="button"
              style={({ pressed }) => [s.row, pressed && { backgroundColor: c.surfaceAlt }]}
            >
              <View style={[s.icon, { backgroundColor: c.surfaceAlt, borderColor: c.border, borderWidth: 1 }]}>
                <Ionicons name="add" size={22} color={c.text} />
              </View>
              <AppText style={s.rowTitle}>{t('home.addHabit')}</AppText>
            </Pressable>
          )}
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingLeft: 14, paddingRight: 12, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  pressed: { opacity: 0.8 },
  pillText: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingTop: 10, paddingHorizontal: 12, gap: 4 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  sheetTitle: { paddingHorizontal: 12, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  rowTitle: { fontSize: 15.5, lineHeight: 22, fontWeight: '600' },
});
