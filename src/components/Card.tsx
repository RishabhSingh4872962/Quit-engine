import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { radius, space, useColors } from '../theme';

export function Card({ style, ...rest }: ViewProps) {
  const c = useColors();
  return <View {...rest} style={[s.card, { backgroundColor: c.surface, borderColor: c.border }, style]} />;
}

const s = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.md + 4, borderWidth: StyleSheet.hairlineWidth },
});
