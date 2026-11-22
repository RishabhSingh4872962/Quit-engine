import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Palette, radius, useColors } from '../theme';
import { AppText } from './AppText';

/** A large tappable choice with a radio dot, used for language, quiz answers and plans. */
export function OptionCard({ label, sub, badge, selected, onPress, tint }: {
  label: string;
  sub?: string; // second line, e.g. a price
  badge?: string; // small pill next to the label, e.g. "7 days free"
  selected: boolean;
  onPress: () => void;
  tint?: Palette; // colour the selection with a specific habit
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
      <View style={s.text}>
        <View style={s.labelRow}>
          <AppText style={s.label} color={selected ? c.accentText : base.text}>{label}</AppText>
          {badge && (
            <View style={[s.badge, { backgroundColor: c.accent }]}>
              <AppText style={s.badgeText} color={c.onAccent}>{badge}</AppText>
            </View>
          )}
        </View>
        {sub && <AppText variant="caption">{sub}</AppText>}
      </View>
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
  text: { flex: 1, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  label: { fontSize: 17, fontWeight: '600' },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotFill: { width: 12, height: 12, borderRadius: 6 },
});
