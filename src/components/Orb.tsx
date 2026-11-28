import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '../theme';
import { AppText } from './AppText';

const ACircle = Animated.createAnimatedComponent(Circle);

/**
 * The Midnight hero: a glowing orb in the habit's colour with the streak inside, and a thin ring
 * around it filling toward the next milestone. It breathes slowly (not with reduced motion).
 */
export function Orb({ value, label, progress, size = 216 }: {
  value: string | number; label: string; progress: number; size?: number;
}) {
  const c = useColors();
  const reduce = useReducedMotion();
  const ring = size + 34;
  const stroke = 4;
  const r = (ring - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withTiming(progress, { duration: 1400, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [progress, fill]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - fill.value) }));

  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    breath.set(withRepeat(withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduce, breath]);
  const orb = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath.value * 0.025 }] }));

  return (
    <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={ring} height={ring} style={StyleSheet.absoluteFill}>
        <Circle cx={ring / 2} cy={ring / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
        <ACircle
          cx={ring / 2}
          cy={ring / 2}
          r={r}
          stroke={c.accentText}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[circumference, circumference]}
          animatedProps={arc}
          transform={`rotate(-90 ${ring / 2} ${ring / 2})`}
        />
      </Svg>
      <Animated.View
        style={[
          s.orb,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: c.accent,
            backgroundImage: `radial-gradient(circle at 34% 28%, ${c.accentLight} 0%, ${c.accent} 46%, ${c.accentDeep} 100%)`,
            boxShadow: `0px 0px 64px ${c.glow}`,
          },
          orb,
        ]}
      >
        <AppText style={[s.value, { fontSize: size * 0.38, lineHeight: size * 0.42 }]} color="#FFFFFF">{value}</AppText>
        <AppText style={s.label} color="rgba(255,255,255,0.92)">{label}</AppText>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  orb: { alignItems: 'center', justifyContent: 'center' },
  value: { fontWeight: '800', letterSpacing: -3 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '500', marginTop: -2 },
});
