import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { radius, useColors } from '../theme';

const APressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 15, stiffness: 300 };

type Variant = 'primary' | 'soft' | 'ghost';

export function Button({ label, onPress, variant = 'primary', icon, style }: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: ViewStyle;
}) {
  const c = useColors();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bg = variant === 'primary' ? c.accent : variant === 'soft' ? c.accentSoft : 'transparent';
  const fg = variant === 'primary' ? c.onAccent : variant === 'soft' ? c.accentText : c.textMuted;

  return (
    <APressable
      accessibilityRole="button"
      onPressIn={() => { scale.set(withSpring(0.96, SPRING)); }}
      onPressOut={() => { scale.set(withSpring(1, SPRING)); }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[s.base, { backgroundColor: bg }, variant === 'ghost' && s.ghost, pressStyle, style]}
    >
      {icon && <Ionicons name={icon} size={20} color={fg} />}
      <Text style={[s.label, { color: fg }, variant === 'ghost' && s.ghostLabel]}>{label}</Text>
    </APressable>
  );
}

const s = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.md,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ghost: { minHeight: 44 },
  label: { fontSize: 17, fontWeight: '700' },
  ghostLabel: { fontSize: 15, fontWeight: '600' },
});
