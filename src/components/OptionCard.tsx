import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Palette, radius, useColors } from '../theme';
import { AppText } from './AppText';

/** A large tappable choice with a radio dot, used for language and quiz answers. */
export function OptionCard({ label, selected, onPress, tint }: {
  label: string; selected: boolean; onPress: () => void; tint?: Palette; // tint: colour the selection with a specific habit
}) {
  const base = useColors();
  const c = tint ?? base;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        s.card,
        {
          backgroundColor: selected ? c.accentSoft : base.surface,
          borderColor: selected ? c.accent : base.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <AppText style={s.label} color={selected ? c.accentText : base.text}>{label}</AppText>
      <View style={[s.dot, { borderColor: selected ? c.accent : base.border }]}>
        {selected && <View style={[s.dotFill, { backgroundColor: c.accent }]} />}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  label: { fontSize: 17, fontWeight: '600', flex: 1 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotFill: { width: 12, height: 12, borderRadius: 6 },
});
