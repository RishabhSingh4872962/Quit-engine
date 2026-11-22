import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { HabitConfig, Lang } from '../habits/types';
import { State, streakDays } from '../lib/storage';

export function Home({ habit, lang, state, onStart, onRelapse, onUrge }: {
  habit: HabitConfig; lang: Lang; state: State;
  onStart: () => void; onRelapse: () => void; onUrge: () => void;
}) {
  const days = streakDays(state);
  const next = habit.milestones.find((m) => m > days);

  return (
    <View style={s.wrap}>
      <Text style={s.title}>{habit.name[lang]}</Text>
      <Text style={s.tag}>{habit.tagline[lang]}</Text>
      <Text style={[s.days, { color: habit.accent }]}>{days}</Text>
      <Text style={s.label}>{lang === 'hi' ? 'दिन' : 'days'}</Text>
      {next !== undefined && (
        <Text style={s.next}>{lang === 'hi' ? `अगला लक्ष्य: ${next} दिन` : `Next milestone: ${next} days`}</Text>
      )}
      {state.streakStart === null ? (
        <Pressable style={[s.btn, { backgroundColor: habit.accent }]} onPress={onStart}>
          <Text style={s.btnText}>{lang === 'hi' ? 'शुरू करें' : 'Start streak'}</Text>
        </Pressable>
      ) : (
        <>
          <Pressable style={[s.btn, { backgroundColor: habit.accent }]} onPress={onUrge}>
            <Text style={s.btnText}>{lang === 'hi' ? 'मुझे तलब हो रही है' : "I'm having an urge"}</Text>
          </Pressable>
          <Pressable onPress={onRelapse}>
            <Text style={s.relapse}>{lang === 'hi' ? 'मैं फिसल गया' : 'I slipped'}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '800' },
  tag: { color: '#666', marginBottom: 24 },
  days: { fontSize: 96, fontWeight: '900' },
  label: { fontSize: 18, color: '#666' },
  next: { marginTop: 8, color: '#888' },
  btn: { marginTop: 32, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 14 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  relapse: { marginTop: 20, color: '#999', textDecorationLine: 'underline' },
});
