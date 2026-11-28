import React from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { fonts, radius, useColors } from '../theme';

/** A Midnight text input: inset surface, hairline border, Poppins, accent cursor. */
export function TextField({ style, ...rest }: TextInputProps) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.textMuted}
      selectionColor={c.glow}
      cursorColor={c.accentText}
      {...rest}
      style={[s.input, { color: c.text, backgroundColor: c.surfaceAlt, borderColor: c.border }, style]}
    />
  );
}

const s = StyleSheet.create({
  input: {
    fontFamily: fonts.regular,
    fontSize: 15,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
