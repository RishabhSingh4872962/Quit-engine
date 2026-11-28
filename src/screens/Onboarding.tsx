import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HABIT_LIST, HABITS } from '../habits';
import { HabitConfig, HabitId } from '../habits/types';
import { LANGS, setLanguage, useLang } from '../i18n';
import { actions } from '../lib/actions';
import { useTracked } from '../lib/storage';
import { makePalette, radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { OptionCard } from '../components/OptionCard';
import { Screen } from '../components/Screen';
import { IconButton } from '../components/IconButton';

type Step = { kind: 'welcome' } | { kind: 'pick' } | { kind: 'quiz'; index: number };
type Answers = Partial<Record<HabitId, Record<string, number>>>;

/** First launch: language → habits → a short quiz per habit. */
export function OnboardingScreen() {
  return <HabitSetup firstRun />;
}

/** Same flow without the welcome step, opened from Home or Settings. */
export function AddHabitScreen() {
  const navigation = useNavigation();
  return <HabitSetup onClose={navigation.goBack} />;
}

function HabitSetup({ firstRun, onClose }: { firstRun?: boolean; onClose?: () => void }) {
  const tracked = useTracked();
  const [step, setStep] = useState<Step>(firstRun ? { kind: 'welcome' } : { kind: 'pick' });
  const [selected, setSelected] = useState<HabitId[]>([]);
  const [answers, setAnswers] = useState<Answers>({});

  // Every question of every selected habit, in order.
  const questions = selected.flatMap((id) => HABITS[id].quiz.map((q) => ({ habit: HABITS[id], q })));

  const finish = (final: Answers) => {
    actions.addHabits(selected.map((id) => ({ id, quizAnswers: final[id] ?? {} })));
    onClose?.();
  };

  if (step.kind === 'welcome') return <Welcome onNext={() => setStep({ kind: 'pick' })} />;

  if (step.kind === 'pick') {
    return (
      <PickHabits
        available={HABIT_LIST.filter((h) => !tracked.includes(h.id))}
        selected={selected}
        onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
        onBack={firstRun ? () => setStep({ kind: 'welcome' }) : undefined}
        onClose={onClose}
        onNext={() => (questions.length ? setStep({ kind: 'quiz', index: 0 }) : finish(answers))}
      />
    );
  }

  const { habit, q } = questions[step.index];
  const pick = (option: number) => {
    const next = { ...answers, [habit.id]: { ...answers[habit.id], [q.id]: option } };
    setAnswers(next);
    // A short pause so the selection is visible before moving on.
    setTimeout(() => {
      if (step.index + 1 < questions.length) setStep({ kind: 'quiz', index: step.index + 1 });
      else finish(next);
    }, 250);
  };

  return (
    <Question
      habit={habit}
      q={q}
      index={step.index}
      total={questions.length}
      selected={answers[habit.id]?.[q.id]}
      onPick={pick}
      onBack={() => setStep(step.index === 0 ? { kind: 'pick' } : { kind: 'quiz', index: step.index - 1 })}
    />
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();

  return (
    <Screen edges={['top', 'bottom']} style={s.between}>
      <View pointerEvents="none" style={[s.halo, { backgroundImage: `radial-gradient(circle, ${c.glow} 0%, rgba(0,0,0,0) 62%)` }]} />
      <Animated.View entering={FadeInDown.duration(600)} style={s.hero}>
        <View
          style={[
            s.mark,
            {
              backgroundColor: c.accent,
              backgroundImage: `radial-gradient(circle at 34% 28%, ${c.accentLight} 0%, ${c.accent} 50%, ${c.accentDeep} 100%)`,
              boxShadow: `0px 0px 60px ${c.glow}`,
            },
          ]}
        >
          <Ionicons name="leaf" size={52} color="#FFFFFF" />
        </View>
        <AppText variant="title" center style={s.appName}>{t('app.name')}</AppText>
        <AppText variant="muted" center>{t('app.tagline')}</AppText>
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

function PickHabits({ available, selected, onToggle, onBack, onClose, onNext }: {
  available: HabitConfig[];
  selected: HabitId[];
  onToggle: (id: HabitId) => void;
  onBack?: () => void;
  onClose?: () => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={s.topRow}>
        {onBack ? (
          <IconButton icon="chevron-back" label={t('onboarding.back')} onPress={onBack} />
        ) : (
          <AppText variant="heading">{t('setup.addTitle')}</AppText>
        )}
        {onClose && <IconButton icon="close" label={t('setup.close')} onPress={onClose} filled />}
      </View>

      <ScrollView style={s.flex} contentContainerStyle={s.pickList} showsVerticalScrollIndicator={false}>
        <AppText variant="title">{t('setup.pickTitle')}</AppText>
        <AppText variant="muted" style={s.pickSub}>{t('setup.pickSub')}</AppText>
        {available.map((h, i) => (
          <Animated.View key={h.id} entering={FadeInDown.delay(60 + i * 60).duration(400)}>
            <HabitCard habit={h} selected={selected.includes(h.id)} onPress={() => onToggle(h.id)} />
          </Animated.View>
        ))}
      </ScrollView>

      <Button label={t('setup.continue')} onPress={onNext} disabled={!selected.length} style={s.continue} />
    </Screen>
  );
}

/** A habit choice: tinted with that habit's own colour. */
function HabitCard({ habit, selected, onPress }: { habit: HabitConfig; selected: boolean; onPress: () => void }) {
  const lang = useLang();
  const c = useColors();
  const h = makePalette(habit.accent, c.scheme);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        s.habitCard,
        {
          backgroundColor: selected ? h.accentSoft : c.surface,
          borderColor: selected ? h.accent : c.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[s.habitIcon, { backgroundColor: selected ? h.surface : h.accentSoft }]}>
        <Ionicons name={habit.icon} size={22} color={h.accent} />
      </View>
      <View style={s.flex}>
        <AppText style={s.habitName} color={selected ? h.accentText : c.text}>{habit.name[lang]}</AppText>
        <AppText variant="caption">{habit.tagline[lang]}</AppText>
      </View>
      <View style={[s.check, { borderColor: selected ? h.accent : c.border, backgroundColor: selected ? h.accent : 'transparent' }]}>
        {selected && <Ionicons name="checkmark" size={16} color={h.onAccent} />}
      </View>
    </Pressable>
  );
}

function Question({ habit, q, index, total, selected, onPick, onBack }: {
  habit: HabitConfig;
  q: HabitConfig['quiz'][number];
  index: number;
  total: number;
  selected: number | undefined;
  onPick: (option: number) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const h = makePalette(habit.accent, c.scheme);

  const fill = useSharedValue(index / total);
  useEffect(() => {
    fill.set(withTiming((index + 1) / total, { duration: 400 }));
  }, [index, total, fill]);
  const bar = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <IconButton icon="chevron-back" label={t('onboarding.back')} onPress={onBack} />
        <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
          <Animated.View style={[s.fill, { backgroundColor: h.accent }, bar]} />
        </View>
      </View>

      <Animated.View key={`${habit.id}-${q.id}`} entering={FadeInRight.duration(350)} style={s.question}>
        <View style={[s.habitTag, { backgroundColor: h.accentSoft }]}>
          <Ionicons name={habit.icon} size={14} color={h.accentText} />
          <AppText style={s.habitTagText} color={h.accentText}>{habit.name[lang]}</AppText>
        </View>
        <AppText variant="label">{t('onboarding.step', { n: index + 1, total })}</AppText>
        <AppText variant="title" style={s.qText}>{q.q[lang]}</AppText>
        {q.options.map((o, i) => (
          <Animated.View key={i} entering={FadeInDown.delay(100 + i * 70).duration(400)}>
            <OptionCard label={o[lang]} selected={selected === i} onPress={() => onPick(i)} tint={h} />
          </Animated.View>
        ))}
      </Animated.View>
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  between: { justifyContent: 'space-between' },
  halo: { position: 'absolute', top: -40, left: -80, right: -80, height: 520 },
  hero: { marginTop: 48, gap: 6, alignItems: 'center' },
  mark: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  appName: { fontSize: 34, lineHeight: 44 },
  sectionLabel: { marginBottom: 12 },
  privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 40 },
  pickList: { paddingTop: 24, paddingBottom: 8 },
  pickSub: { marginTop: 4, marginBottom: 20 },
  continue: { marginTop: 12 },
  habitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 12,
  },
  habitIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  habitName: { fontSize: 17, fontWeight: '700' },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  question: { marginTop: 32 },
  habitTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: 14,
  },
  habitTagText: { fontSize: 13, fontWeight: '700' },
  qText: { marginTop: 8, marginBottom: 28 },
});
