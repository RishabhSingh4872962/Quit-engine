import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { radius, useColors } from '../theme';
import { AppText } from './AppText';

const PAD = 4;

/** Pill switcher with a sliding thumb, e.g. 7 days | 30 days or Timer | Pomodoro | Stopwatch. */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const segment = width / options.length;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (!segment) return;
    // Jump into place on first layout, slide on later changes.
    x.set(placed.current ? withSpring(index * segment, { damping: 18, stiffness: 220 }) : index * segment);
    placed.current = true;
  }, [index, segment, x]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      accessibilityRole="radiogroup"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - PAD * 2)}
      style={[s.track, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}
    >
      {segment > 0 && <Animated.View style={[s.thumb, { width: segment, backgroundColor: c.surfaceHigh }, thumb]} />}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            style={s.segment}
            onPress={() => {
              if (active) return;
              void Haptics.selectionAsync();
              onChange(o.value);
            }}
          >
            <AppText style={s.label} color={active ? c.text : c.textMuted} numberOfLines={1}>{o.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.pill, padding: PAD, borderWidth: 1 },
  thumb: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: radius.pill },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
