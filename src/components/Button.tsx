import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { glowShadow, radius, useColors } from '../theme';
import { AppText } from './AppText';

const APressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 15, stiffness: 300 };

type Variant = 'primary' | 'soft' | 'ghost';

/**
 * Primary: a pill with the habit's gradient and a soft glow (the one main action on a screen).
 * Soft: a dark filled pill. Ghost: text only, for secondary choices.
 */
export function Button({ label, onPress, variant = 'primary', icon, style, disabled }: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: ViewStyle;
  disabled?: boolean;
}) {
  const c = useColors();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const fg = variant === 'primary' ? c.onAccent : variant === 'soft' ? c.accentText : c.textMuted;
  const look: ViewStyle =
    variant === 'primary'
      ? {
          backgroundColor: c.accent,
          backgroundImage: `linear-gradient(90deg, ${c.accentLight}, ${c.accent})`,
          boxShadow: disabled ? undefined : glowShadow(c.glow, 26, 8),
        }
      : variant === 'soft'
        ? { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border }
        : {};

  return (
    <APressable
      accessibilityRole="button"
      accessibilityLabel={label} // not the icon glyph
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={() => { scale.set(withSpring(0.97, SPRING)); }}
      onPressOut={() => { scale.set(withSpring(1, SPRING)); }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[s.base, look, variant === 'ghost' && s.ghost, disabled && s.disabled, pressStyle, style]}
    >
      {icon && <Ionicons name={icon} size={20} color={fg} />}
      <AppText style={[s.label, variant === 'ghost' && s.ghostLabel]} color={fg}>{label}</AppText>
    </APressable>
  );
}

const s = StyleSheet.create({
  base: {
    minHeight: 58,
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ghost: { minHeight: 44 },
  disabled: { opacity: 0.4 },
  label: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  ghostLabel: { fontSize: 14.5, fontWeight: '500' },
});
