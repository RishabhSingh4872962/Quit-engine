import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, SharedValue, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const COUNT = 16;

/** A one-shot burst of soft dots from the centre, for celebrations. */
export function Burst({ colors, radius = 150 }: { colors: string[]; radius?: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(150, withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) })));
  }, [t]);

  return (
    <View pointerEvents="none" style={s.center}>
      {Array.from({ length: COUNT }, (_, i) => (
        <Particle
          key={i}
          t={t}
          angle={(i / COUNT) * Math.PI * 2}
          distance={radius * (0.7 + 0.3 * ((i * 7) % 5) / 4)}
          size={8 + ((i * 5) % 3) * 3}
          color={colors[i % colors.length]}
        />
      ))}
    </View>
  );
}

function Particle({ t, angle, distance, size, color }: {
  t: SharedValue<number>; angle: number; distance: number; size: number; color: string;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.6 ? 1 : 1 - (t.value - 0.6) / 0.4,
    transform: [
      { translateX: Math.cos(angle) * distance * t.value },
      { translateY: Math.sin(angle) * distance * t.value },
      { scale: 0.4 + t.value * 0.6 },
    ],
  }));
  return <Animated.View style={[s.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

const s = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute' },
});
