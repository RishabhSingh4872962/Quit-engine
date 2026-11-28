import React from 'react';
import { StyleSheet, Text, TextProps, TextStyle } from 'react-native';
import { fontFor, useColors } from '../theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'muted' | 'caption' | 'label';

/**
 * All text in the app. Poppins everywhere; a `fontWeight` in `style` picks the matching Poppins
 * file (Android ignores fontWeight for custom fonts), so screens can keep writing fontWeight.
 */
export function AppText({ variant = 'body', color, center, style, ...rest }: TextProps & {
  variant?: Variant; color?: string; center?: boolean;
}) {
  const c = useColors();
  const muted = variant === 'muted' || variant === 'caption' || variant === 'label';
  const flat = StyleSheet.flatten([s[variant], style]) as TextStyle;
  const { fontWeight, ...restStyle } = flat ?? {};
  return (
    <Text
      {...rest}
      style={[
        restStyle,
        { fontFamily: restStyle.fontFamily ?? fontFor(fontWeight ?? WEIGHT[variant]), color: color ?? restStyle.color ?? (muted ? c.textMuted : c.text) },
        center && styles.center,
      ]}
    />
  );
}

const WEIGHT: Record<Variant, TextStyle['fontWeight']> = {
  display: '800',
  title: '700',
  heading: '600',
  body: '400',
  muted: '400',
  caption: '400',
  label: '600',
};

const s = StyleSheet.create({
  // Poppins has tall line metrics: fixed line heights and no font padding keep text aligned.
  display: { fontSize: 72, lineHeight: 80, letterSpacing: -2, includeFontPadding: false },
  title: { fontSize: 28, lineHeight: 38, letterSpacing: -0.4, includeFontPadding: false },
  heading: { fontSize: 18, lineHeight: 26, includeFontPadding: false },
  body: { fontSize: 15, lineHeight: 23, includeFontPadding: false },
  muted: { fontSize: 14, lineHeight: 21, includeFontPadding: false },
  caption: { fontSize: 12.5, lineHeight: 18, includeFontPadding: false },
  label: { fontSize: 11.5, lineHeight: 16, letterSpacing: 0.9, textTransform: 'uppercase', includeFontPadding: false },
});

const styles = StyleSheet.create({ center: { textAlign: 'center' } });
