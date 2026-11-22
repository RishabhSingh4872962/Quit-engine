import React from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useColors } from '../theme';
import { AppText } from './AppText';

/** A title + subtitle with a switch on the right. */
export function ToggleRow({ title, sub, value, onChange }: {
  title: string; sub: string; value: boolean; onChange: (on: boolean) => void;
}) {
  const c = useColors();
  return (
    <View style={s.row}>
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
        accessibilityLabel={title}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600' },
});
