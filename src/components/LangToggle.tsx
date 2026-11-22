import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Lang } from '../habits/types';
import { LANGS } from '../lib/i18n';

export function LangToggle({ lang, accent, onChange }: {
  lang: Lang; accent: string; onChange: (lang: Lang) => void;
}) {
  return (
    <View style={s.row} accessibilityRole="radiogroup">
      {LANGS.map(({ id, label }) => {
        const active = id === lang;
        return (
          <Pressable
            key={id}
            hitSlop={8}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            style={[s.pill, { borderColor: accent }, active && { backgroundColor: accent }]}
            onPress={() => onChange(id)}
          >
            <Text style={[s.text, { color: active ? '#fff' : accent }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  pill: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  text: { fontSize: 14, fontWeight: '600' },
});
