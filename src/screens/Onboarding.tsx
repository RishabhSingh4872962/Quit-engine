import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { ACTIVE_HABIT as habit } from '../habits';
import { LANGS, setLanguage, useLang } from '../i18n';
import { actions } from '../lib/actions';
import { radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { OptionCard } from '../components/OptionCard';
import { Screen } from '../components/Screen';

const WELCOME = -1;

export function OnboardingScreen() {
  const [step, setStep] = useState(WELCOME);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  if (step === WELCOME) return <Welcome onNext={() => setStep(0)} />;

  const q = habit.quiz[step];
  const pick = (idx: number) => {
    const next = { ...answers, [q.id]: idx };
    setAnswers(next);
    // A short pause so the selection is visible before moving on.
    setTimeout(() => {
      if (step + 1 < habit.quiz.length) setStep(step + 1);
      else actions.finishQuiz(next);
    }, 250);
  };

  return <Question step={step} selected={answers[q.id]} onPick={pick} onBack={() => setStep(step - 1)} />;
}

function Welcome({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();

  return (
    <Screen edges={['top', 'bottom']} style={s.between}>
      <Animated.View entering={FadeInDown.duration(600)} style={s.hero}>
        <View style={[s.badge, { backgroundColor: c.accentSoft }]}>
          <Ionicons name="leaf" size={40} color={c.accent} />
        </View>
        <AppText variant="title">{habit.name[lang]}</AppText>
        <AppText variant="muted">{habit.tagline[lang]}</AppText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(600)}>
        <AppText variant="label" style={s.sectionLabel}>{t('onboarding.chooseLanguage')}</AppText>
        {LANGS.map((l) => (
          <OptionCard key={l.id} label={l.label} selected={lang === l.id} onPress={() => setLanguage(l.id)} />
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(600)}>
        <Button label={t('onboarding.getStarted')} onPress={onNext} />
        <View style={s.privacy}>
          <Ionicons name="lock-closed" size={13} color={c.textMuted} />
          <AppText variant="caption">{t('onboarding.privacy')}</AppText>
        </View>
      </Animated.View>
    </Screen>
  );
}

function Question({ step, selected, onPick, onBack }: {
  step: number; selected: number | undefined; onPick: (idx: number) => void; onBack: () => void;
}) {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const q = habit.quiz[step];
  const total = habit.quiz.length;

  const fill = useSharedValue(step / total);
  useEffect(() => {
    fill.set(withTiming((step + 1) / total, { duration: 400 }));
  }, [step, total, fill]);
  const bar = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('onboarding.back')}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </Pressable>
        <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
          <Animated.View style={[s.fill, { backgroundColor: c.accent }, bar]} />
        </View>
      </View>

      <Animated.View key={q.id} entering={FadeInRight.duration(350)} style={s.question}>
        <AppText variant="label">{t('onboarding.step', { n: step + 1, total })}</AppText>
        <AppText variant="title" style={s.qText}>{q.q[lang]}</AppText>
        {q.options.map((o, i) => (
          <Animated.View key={i} entering={FadeInDown.delay(100 + i * 70).duration(400)}>
            <OptionCard label={o[lang]} selected={selected === i} onPress={() => onPick(i)} />
          </Animated.View>
        ))}
      </Animated.View>
    </Screen>
  );
}

const s = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  hero: { marginTop: 40, gap: 6 },
  badge: { width: 76, height: 76, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  sectionLabel: { marginBottom: 12 },
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  question: { marginTop: 40 },
  qText: { marginTop: 8, marginBottom: 28 },
});
