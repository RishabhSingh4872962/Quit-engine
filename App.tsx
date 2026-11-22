import React, { useEffect, useState } from 'react';
import { SafeAreaView, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ACTIVE_HABIT as habit } from './src/habits';
import { EMPTY, State, load, save } from './src/lib/storage';
import { useDeviceLang } from './src/lib/i18n';
import { LangToggle } from './src/components/LangToggle';
import { Onboarding } from './src/screens/Onboarding';
import { Home } from './src/screens/Home';
import { Urge } from './src/screens/Urge';

type Screen = 'home' | 'urge';

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const deviceLang = useDeviceLang();

  useEffect(() => { load(habit.id).then(setState); }, []);

  const update = (patch: Partial<State>) => {
    const next = { ...(state ?? EMPTY), ...patch };
    setState(next);
    void save(habit.id, next);
  };

  if (!state) return <ActivityIndicator style={{ flex: 1 }} />;

  const onboarded = Object.keys(state.quizAnswers).length === habit.quiz.length;
  const lang = state.lang ?? deviceLang;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar style="dark" />
      {screen !== 'urge' && (
        <LangToggle lang={lang} accent={habit.accent} onChange={(l) => update({ lang: l })} />
      )}
      {!onboarded ? (
        <Onboarding habit={habit} lang={lang} onDone={(quizAnswers) => update({ quizAnswers })} />
      ) : screen === 'urge' ? (
        <Urge habit={habit} lang={lang} onDone={(resisted) => {
          if (resisted) update({ urgesResisted: state.urgesResisted + 1 });
          setScreen('home');
        }} />
      ) : (
        <Home
          habit={habit} lang={lang} state={state}
          onStart={() => update({ streakStart: Date.now() })}
          onRelapse={() => update({ relapses: [...state.relapses, Date.now()], streakStart: Date.now() })}
          onUrge={() => setScreen('urge')}
        />
      )}
    </SafeAreaView>
  );
}
