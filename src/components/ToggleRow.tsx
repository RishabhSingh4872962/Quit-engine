import React from 'react';
import { Pressable, StyleSheet, Switch, View, ViewStyle } from 'react-native';
import { useColors } from '../theme';
import { AppText } from './AppText';

/**
 * A title + subtitle with a switch on the right. The whole row toggles (not only the small switch),
 * and screen readers get it as one switch. `leading` (an icon circle) and `style` (padding inside a
 * settings group) are optional.
 */
export function ToggleRow({ title, sub, value, onChange, leading, style }: {
  title: string; sub: string; value: boolean; onChange: (on: boolean) => void; leading?: React.ReactNode; style?: ViewStyle;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={title}
      accessibilityHint={sub}
      style={({ pressed }) => [s.row, style, pressed && (style ? { backgroundColor: c.surfaceAlt } : s.pressed)]}
    >
      {leading}
      <View style={s.flex}>
        <AppText style={s.title}>{title}</AppText>
        <AppText variant="caption">{sub}</AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: c.surfaceHigh, true: c.accent }}
        thumbColor={value ? '#FFFFFF' : '#C9C7DA'}
        ios_backgroundColor={c.surfaceHigh}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
  title: { fontSize: 15.5, lineHeight: 22, fontWeight: '600' },
});
