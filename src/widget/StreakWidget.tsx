'use no memo'; // widget trees are converted to native views, not rendered by React
import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { Palette } from '../theme';

type Hex = `#${string}`;

// Ionicons "leaf" (MIT) as an SVG, so the widget doesn't need the whole 390 KB icon font.
const LEAF_PATH =
  'M161.35 242a16 16 0 0122.62-.68c73.63 69.36 147.51 111.56 234.45 133.07 11.73-32 12.77-67.22 2.64-101.58-13.44-45.59-44.74-85.31-90.49-114.86-40.84-26.38-81.66-33.25-121.15-39.89-49.82-8.38-96.88-16.3-141.79-63.85-5-5.26-11.81-7.37-18.32-5.66-7.44 2-12.43 7.88-14.82 17.6-5.6 22.75-2 86.51 13.75 153.82 25.29 108.14 65.65 162.86 95.06 189.73 38 34.69 87.62 53.9 136.93 53.9a186 186 0 0027.77-2.04c41.71-6.32 76.43-27.27 96-57.75-89.49-23.28-165.94-67.55-242-139.16a16 16 0 01-.65-22.65zM467.43 384.19c-16.83-2.59-33.13-5.84-49-9.77a157.71 157.71 0 01-12.13 25.68c-.73 1.25-1.5 2.49-2.29 3.71a584.21 584.21 0 0058.56 12 16 16 0 104.87-31.62z';

const leaf = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="${color}" d="${LEAF_PATH}"/></svg>`;

/**
 * Home-screen widget: the streak number and "days", nothing that names the habit
 * (it sits on a home screen other people may see). Tapping it opens the app.
 */
export function StreakWidget({ days, unit, colors, size }: {
  days: number;
  unit: string;
  colors: Palette;
  size: number; // the widget's smaller side, in dp
}) {
  const numberSize = Math.max(28, Math.min(64, Math.round(size * 0.36)));
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={`${days} ${unit}`}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: colors.surface as Hex,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
      }}
    >
      <SvgWidget svg={leaf(colors.accent)} style={{ width: 20, height: 20 }} />
      <TextWidget
        text={String(days)}
        style={{ fontSize: numberSize, fontFamily: 'Baloo2_800ExtraBold', color: colors.accentText as Hex }}
      />
      <TextWidget text={unit} style={{ fontSize: 14, color: colors.textMuted as Hex }} />
    </FlexWidget>
  );
}
