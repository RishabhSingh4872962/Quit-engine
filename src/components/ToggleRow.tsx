import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { useColors } from '../theme';
import { AppText } from './AppText';

/**
 * A title + subtitle with a switch on the right. The whole row toggles (not only the small switch),
 * and screen readers get it as one switch.
 */
export function ToggleRow({ title, sub, value, onChange }: {
  title: string; sub: string; value: boolean; onChange: (on: boolean) => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={title}
      accessibilityHint={sub}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
    >
      <View style={s.flex}>
        <AppText style={s.title}>{title}</AppText>
        <AppText variant="caption">{sub}</AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: c.surfaceAlt, true: c.accent }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={c.surfaceAlt}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600' },
});
