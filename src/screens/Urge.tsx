import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { HabitConfig, Lang } from '../habits/types';

const PHASES = [
  { en: 'Breathe in', hi: 'साँस अंदर', secs: 4 },
  { en: 'Hold', hi: 'रोकें', secs: 4 },
  { en: 'Breathe out', hi: 'साँस बाहर', secs: 6 },
] as const;
const TOTAL_CYCLES = 4;

export function Urge({ habit, lang, onDone }: { habit: HabitConfig; lang: Lang; onDone: (resisted: boolean) => void }) {
  const [phase, setPhase] = useState(0);
  const [left, setLeft] = useState<number>(PHASES[0].secs);
  const [cycle, setCycle] = useState(0);
  const finished = cycle >= TOTAL_CYCLES;

  useEffect(() => {
    if (finished) return;
    const t = setTimeout(() => {
      if (left > 1) return setLeft(left - 1);
      const np = (phase + 1) % PHASES.length;
      if (np === 0) setCycle((c) => c + 1);
      setPhase(np);
      setLeft(PHASES[np].secs);
    }, 1000);
    return () => clearTimeout(t);
  }, [left, phase, finished]);

  return (
    <View style={s.wrap}>
      {finished ? (
        <>
          <Text style={s.big}>{lang === 'hi' ? 'शाबाश!' : 'Well done!'}</Text>
          <Text style={s.sub}>{lang === 'hi' ? 'क्या तलब कम हुई?' : 'Did the urge pass?'}</Text>
          <Pressable style={[s.btn, { backgroundColor: habit.accent }]} onPress={() => onDone(true)}>
            <Text style={s.btnText}>{lang === 'hi' ? 'हाँ' : 'Yes'}</Text>
          </Pressable>
          <Pressable onPress={() => onDone(false)}>
            <Text style={s.skip}>{lang === 'hi' ? 'अभी नहीं' : 'Not yet'}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[s.big, { color: habit.accent }]}>{PHASES[phase][lang]}</Text>
          <Text style={s.count}>{left}</Text>
          <Text style={s.sub}>{cycle + 1} / {TOTAL_CYCLES}</Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  big: { fontSize: 36, fontWeight: '800' },
  count: { fontSize: 96, fontWeight: '900', marginVertical: 12 },
  sub: { color: '#666', fontSize: 18 },
  btn: { marginTop: 28, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  skip: { marginTop: 18, color: '#999' },
});
