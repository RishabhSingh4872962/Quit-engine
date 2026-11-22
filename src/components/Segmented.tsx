import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { radius, useColors } from '../theme';

const PAD = 4;

/** Pill switcher with a sliding thumb, e.g. English | हिंदी or System | Light | Dark. */
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
      style={[s.track, { backgroundColor: c.surfaceAlt }]}
    >
      {segment > 0 && (
        <Animated.View style={[s.thumb, { width: segment, backgroundColor: c.scheme === 'dark' ? c.accentSoft : c.surface }, thumb]} />
      )}
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
            <Text style={[s.label, { color: active ? c.text : c.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.pill, padding: PAD },
  thumb: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radius.pill,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '600' },
});
