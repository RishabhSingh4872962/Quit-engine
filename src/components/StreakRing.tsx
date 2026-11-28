import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { Easing, ReduceMotion, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { useColors } from '../theme';

const ACircle = Animated.createAnimatedComponent(Circle);

/**
 * A glowing progress ring (the focus timer): gradient arc in the habit's colour on a faint track,
 * a soft halo behind, a dark disc inside for the content. Fills from empty on mount.
 */
export function StreakRing({ progress, size = 264, stroke = 18, children }: {
  progress: number; size?: number; stroke?: number; children?: React.ReactNode;
}) {
  const c = useColors();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const p = useSharedValue(0);

  useEffect(() => {
    p.set(withTiming(progress, { duration: 1400, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [progress, p]);

  const arc = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - p.value) }));
  const inner = size - stroke * 2 - 22;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, boxShadow: `0px 0px 56px ${c.glow}` }]} />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.accentLight} />
            <Stop offset="1" stopColor={c.accent} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.bg} strokeWidth={stroke} fill={c.bg} />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
        <ACircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[circumference, circumference]}
          animatedProps={arc}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[s.inner, { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: c.surface, borderColor: c.border }]}>
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  inner: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
