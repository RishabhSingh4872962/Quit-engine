import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { HabitConfig, Lang } from '../habits/types';
import { StringKey, t } from '../lib/i18n';

const PHASES: { label: StringKey; secs: number }[] = [
  { label: 'breatheIn', secs: 4 },
  { label: 'hold', secs: 4 },
  { label: 'breatheOut', secs: 6 },
];
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
          <Text style={s.big}>{t(lang, 'wellDone')}</Text>
          <Text style={s.sub}>{t(lang, 'urgePassed')}</Text>
          <Pressable style={[s.btn, { backgroundColor: habit.accent }]} onPress={() => onDone(true)}>
            <Text style={s.btnText}>{t(lang, 'yes')}</Text>
          </Pressable>
          <Pressable onPress={() => onDone(false)}>
            <Text style={s.skip}>{t(lang, 'notYet')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[s.big, { color: habit.accent }]}>{t(lang, PHASES[phase].label)}</Text>
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
