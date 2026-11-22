import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { HabitConfig, Lang } from '../habits/types';

export function Onboarding({ habit, lang, onDone }: {
  habit: HabitConfig; lang: Lang; onDone: (answers: Record<string, number>) => void;
}) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const q = habit.quiz[i];

  const pick = (idx: number) => {
    const next = { ...answers, [q.id]: idx };
    setAnswers(next);
    if (i + 1 < habit.quiz.length) setI(i + 1);
    else onDone(next);
  };

  return (
    <View style={s.wrap}>
      <Text style={s.step}>{i + 1} / {habit.quiz.length}</Text>
      <Text style={s.q}>{q.q[lang]}</Text>
      {q.options.map((o, idx) => (
        <Pressable key={idx} style={[s.opt, { borderColor: habit.accent }]} onPress={() => pick(idx)}>
          <Text style={s.optText}>{o[lang]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'center' },
  step: { color: '#888', marginBottom: 8 },
  q: { fontSize: 24, fontWeight: '700', marginBottom: 24 },
  opt: { borderWidth: 2, borderRadius: 12, padding: 16, marginBottom: 12 },
  optText: { fontSize: 18 },
});
