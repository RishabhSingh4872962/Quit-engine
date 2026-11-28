import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Text as SvgText } from 'react-native-svg';

const LEAF = '#4CAF7A';
const LEAF_DARK = '#2E8B57';
const REST_LEAF = '#9DB8A5';
const REST_DARK = '#7E9A88';
const STEM = '#3E8E5B';
const TRUNK = '#8D6E63';
const POT = '#D9825B';
const POT_RIM = '#C46F49';
const SOIL = '#6D4C41';
const PETAL = '#F48FB1';
const CENTER = '#FFD166';
const FRUIT = '#FF8A65';

/** A pot plant drawn for a growth stage (0 seed … 6 tree). Resting: muted, drooping, "z z", no sway. */
export function Plant({ stage, resting, size = 140 }: { stage: number; resting?: boolean; size?: number }) {
  const reduce = useReducedMotion();
  const sway = useSharedValue(0);
  useEffect(() => {
    if (resting || reduce) {
      sway.set(0);
      return;
    }
    sway.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System }), -1, true));
  }, [resting, reduce, sway]);
  const swayStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${(sway.value - 0.5) * 4}deg` }] }));

  const leaf = resting ? REST_LEAF : LEAF;
  const dark = resting ? REST_DARK : LEAF_DARK;
  const height = size * (140 / 120);

  return (
    <View style={{ width: size, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, s.origin, swayStyle]}>
        <Svg width={size} height={height} viewBox="0 0 120 140">
          <G transform={resting ? 'rotate(7 60 105)' : undefined}>{drawStage(stage, leaf, dark)}</G>
          {resting && (
            <G opacity={0.7}>
              <SvgText x={86} y={34} fontSize={12} fontWeight="bold" fill={REST_DARK}>z</SvgText>
              <SvgText x={95} y={24} fontSize={9} fontWeight="bold" fill={REST_DARK}>z</SvgText>
            </G>
          )}
        </Svg>
      </Animated.View>
      <Svg width={size} height={height} viewBox="0 0 120 140" style={StyleSheet.absoluteFill}>
        <Ellipse cx={60} cy={106} rx={26} ry={5} fill={SOIL} />
        <Path d="M32 104 H88 L82 136 Q81 139 78 139 H42 Q39 139 38 136 Z" fill={POT} />
        <Path d="M30 101 H90 V108 H30 Z" fill={POT_RIM} />
      </Svg>
    </View>
  );
}

const leafAt = (x: number, y: number, angle: number, color: string, rx = 9, ry = 4.5, key?: string) => (
  <Ellipse key={key} cx={x} cy={y} rx={rx} ry={ry} fill={color} transform={`rotate(${angle} ${x} ${y})`} />
);

const flower = (x: number, y: number, key: string) => (
  <G key={key}>
    {[0, 72, 144, 216, 288].map((a) => (
      <Circle key={a} cx={x + 3.2 * Math.cos((a * Math.PI) / 180)} cy={y + 3.2 * Math.sin((a * Math.PI) / 180)} r={2.6} fill={PETAL} />
    ))}
    <Circle cx={x} cy={y} r={1.8} fill={CENTER} />
  </G>
);

function drawStage(stage: number, leaf: string, dark: string) {
  if (stage <= 0) {
    return (
      <G>
        <Ellipse cx={60} cy={101} rx={6} ry={4} fill="#A1887F" />
        <Path d="M60 98 Q61 93 64 92" stroke={STEM} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      </G>
    );
  }
  if (stage <= 3) {
    const top = [0, 86, 74, 60][stage];
    const pairs = [[], [86], [92, 78], [94, 82, 70]][stage];
    return (
      <G>
        <Path d={`M60 105 Q58 ${(105 + top) / 2} 60 ${top}`} stroke={STEM} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        {pairs.flatMap((y, i) => [
          leafAt(51, y, -28, i % 2 ? dark : leaf, 9, 4.5, `l${i}`),
          leafAt(69, y - 2, 28, i % 2 ? leaf : dark, 9, 4.5, `r${i}`),
        ])}
        {stage === 3 && <Ellipse cx={60} cy={58} rx={3.5} ry={5} fill={dark} />}
      </G>
    );
  }
  if (stage <= 5) {
    return (
      <G>
        <Path d="M60 105 L60 74" stroke={STEM} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={60} cy={80} r={13} fill={dark} />
        <Circle cx={45} cy={70} r={14} fill={leaf} />
        <Circle cx={75} cy={70} r={14} fill={leaf} />
        <Circle cx={60} cy={55} r={16} fill={leaf} />
        <Circle cx={52} cy={62} r={8} fill={dark} opacity={0.35} />
        {stage === 5 && [flower(44, 64, 'f1'), flower(74, 62, 'f2'), flower(60, 46, 'f3'), flower(66, 76, 'f4'), flower(50, 80, 'f5')]}
      </G>
    );
  }
  return (
    <G>
      <Path d="M56 105 L57 66 L63 66 L64 105 Z" fill={TRUNK} />
      <Path d="M60 80 L48 68 M60 76 L72 64" stroke={TRUNK} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={60} cy={64} r={18} fill={dark} />
      <Circle cx={40} cy={54} r={19} fill={leaf} />
      <Circle cx={80} cy={54} r={19} fill={leaf} />
      <Circle cx={60} cy={36} r={23} fill={leaf} />
      <Circle cx={60} cy={58} r={14} fill={leaf} />
      {[[44, 48], [76, 46], [62, 28], [52, 62], [72, 62]].map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={3.4} fill={FRUIT} />
      ))}
    </G>
  );
}

const s = StyleSheet.create({
  origin: { transformOrigin: '50% 75%' },
});
