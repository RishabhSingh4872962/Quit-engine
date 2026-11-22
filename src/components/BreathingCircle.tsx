import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { withAlpha } from '../lib/color';
import { useColors } from '../theme';

export type BreathPhase = 'in' | 'hold' | 'out';

const SMALL = 0.5;

/** Grows while breathing in, rests while holding, shrinks while breathing out. */
export function BreathingCircle({ phase, secs, size = 280, children }: {
  phase: BreathPhase; secs: number; size?: number; children?: React.ReactNode;
}) {
  const c = useColors();
  const scale = useSharedValue(SMALL);

  useEffect(() => {
    if (phase === 'hold') return;
    scale.set(withTiming(phase === 'in' ? 1 : SMALL, {
      duration: secs * 1000,
      easing: Easing.inOut(Easing.sin),
    }));
  }, [phase, secs, scale]);

  const halo = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 0.4 + 0.6 * scale.value,
  }));
  const middle = useAnimatedStyle(() => ({ transform: [{ scale: 0.45 + 0.4 * scale.value }] }));

  const disc = (d: number) => ({ width: d, height: d, borderRadius: d / 2 });

  return (
    <View style={[s.center, { width: size, height: size }]}>
      <Animated.View style={[s.abs, disc(size), { backgroundColor: withAlpha(c.accent, 0.14) }, halo]} />
      <Animated.View style={[s.abs, disc(size), { backgroundColor: withAlpha(c.accent, 0.28) }, middle]} />
      <View style={[s.center, disc(size * 0.38), { backgroundColor: c.accent }]}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
});
