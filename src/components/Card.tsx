import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { radius, useColors } from '../theme';

/** A Midnight surface: dark glass with a hairline border. */
export function Card({ style, ...rest }: ViewProps) {
  const c = useColors();
  return <View {...rest} style={[s.card, { backgroundColor: c.surface, borderColor: c.border }, style]} />;
}

const s = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 18, borderWidth: 1 },
});
