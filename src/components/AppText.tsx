import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';
import { fonts, useColors } from '../theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'muted' | 'caption' | 'label';

export function AppText({ variant = 'body', color, center, style, ...rest }: TextProps & {
  variant?: Variant; color?: string; center?: boolean;
}) {
  const c = useColors();
  const muted = variant === 'muted' || variant === 'caption' || variant === 'label';
  return (
    <Text
      {...rest}
      style={[s[variant], { color: color ?? (muted ? c.textMuted : c.text) }, center && s.center, style]}
    />
  );
}

const s = StyleSheet.create({
  // Baloo 2 has tall Devanagari metrics: fixed line heights keep Latin text from floating.
  display: { fontFamily: fonts.display, fontSize: 76, lineHeight: 84, includeFontPadding: false },
  title: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 40, includeFontPadding: false },
  heading: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 28, includeFontPadding: false },
  body: { fontSize: 16, lineHeight: 24 },
  muted: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  center: { textAlign: 'center' },
});
