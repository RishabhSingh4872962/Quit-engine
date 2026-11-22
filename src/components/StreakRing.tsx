import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { useColors } from '../theme';

const ACircle = Animated.createAnimatedComponent(Circle);

/** Progress ring toward the next milestone. Fills from empty on mount, then follows `progress`. */
export function StreakRing({ progress, size = 264, stroke = 18, children }: {
  progress: number; size?: number; stroke?: number; children?: React.ReactNode;
}) {
  const c = useColors();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const p = useSharedValue(0);

  useEffect(() => {
    p.set(withTiming(progress, { duration: 1400, easing: Easing.out(Easing.cubic) }));
  }, [progress, p]);

  const arc = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - p.value) }));
  const inner = size - stroke * 2 - 20;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.accentSoft} strokeWidth={stroke} fill="none" />
        <ACircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[circumference, circumference]}
          animatedProps={arc}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[s.inner, { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: c.surface }]}>
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
});
