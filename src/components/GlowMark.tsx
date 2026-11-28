import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '../theme';

/**
 * A small glowing sphere in the habit's colour with a white icon: the mark for hero moments
 * (welcome, Premium, a reached milestone). Same light as the streak orb, without the number.
 */
export function GlowMark({ icon, size = 120, style }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; size?: number; style?: ViewStyle;
}) {
  const c = useColors();
  return (
    <View
      style={[
        s.mark,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.accent,
          backgroundImage: `radial-gradient(circle at 34% 28%, ${c.accentLight} 0%, ${c.accent} 50%, ${c.accentDeep} 100%)`,
          boxShadow: `0px 0px ${Math.round(size / 2)}px ${c.glow}`,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.43)} color="#FFFFFF" />
    </View>
  );
}

const s = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center' },
});
