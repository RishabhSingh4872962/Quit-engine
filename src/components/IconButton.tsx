import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { radius, useColors } from '../theme';

/** Round icon-only button (close, back, share). `filled` adds a soft circle behind the icon. */
export function IconButton({ icon, label, onPress, filled }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; filled?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={filled ? [s.filled, { backgroundColor: c.surfaceAlt }] : undefined}
    >
      <Ionicons name={icon} size={filled ? 22 : 26} color={c.text} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  filled: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
