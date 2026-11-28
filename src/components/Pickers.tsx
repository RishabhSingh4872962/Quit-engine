import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { radius, useColors } from '../theme';
import { AppText } from './AppText';

/** Wrapping chips. One can be picked; tapping it again clears it (when `clearable`). */
export function ChoiceChips<T extends string>({ options, value, onChange, clearable = true }: {
  options: { id: T; label: string }[];
  value?: T;
  onChange: (id: T | undefined) => void;
  clearable?: boolean;
}) {
  const c = useColors();
  return (
    <View style={s.chips} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
              if (on && !clearable) return;
              void Haptics.selectionAsync();
              onChange(on ? undefined : o.id);
            }}
            style={[s.chip, { backgroundColor: on ? c.accent : c.surfaceAlt }]}
          >
            <AppText style={s.chipText} color={on ? c.onAccent : c.text}>{o.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A 1–5 row (urge strength, mood). Tapping the picked one clears it. `big` is for emoji. */
export function ScalePicker({ labels, a11y, value, onChange, big }: {
  labels: readonly string[];
  a11y: (n: number) => string;
  value?: number;
  onChange: (n: number | undefined) => void;
  big?: boolean;
}) {
  const c = useColors();
  return (
    <View style={s.scale} accessibilityRole="radiogroup">
      {labels.map((label, i) => {
        const n = i + 1;
        const on = n === value;
        return (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={a11y(n)}
            accessibilityState={{ checked: on }}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(on ? undefined : n);
            }}
            style={[s.step, big && s.bigStep, { backgroundColor: on ? c.accent : c.surfaceAlt }]}
          >
            <AppText style={big ? s.emoji : s.stepText} color={on ? c.onAccent : c.text}>{label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  chipText: { fontWeight: '600', fontSize: 15, lineHeight: 20 },
  scale: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, height: 46, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  bigStep: { height: 58 },
  stepText: { fontWeight: '700', fontSize: 17, lineHeight: 22 },
  emoji: { fontSize: 28, lineHeight: 36 },
});
