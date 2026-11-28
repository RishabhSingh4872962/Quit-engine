import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StackActions, StaticScreenProps, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useLang } from '../i18n';
import { Deck, learnDecks, makeRound, txt } from '../learn/decks';
import { withAlpha } from '../lib/color';
import { EARN_CAP, EARN_LEARN_REELS, earnReels, useEarnedToday } from '../lib/earn';
import { openReelApp } from '../lib/reels';
import { storage } from '../lib/storage';
import { useNow } from '../lib/streak';
import { fonts, radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconButton } from '../components/IconButton';
import { ChoiceChips } from '../components/Pickers';
import { LIVE } from '../components/RoomCard';
import { Screen } from '../components/Screen';

type Props = StaticScreenProps<{ app?: string } | undefined>;

const ROUND = 5; // questions per round
const NEED = 3; // right answers that earn reels
const WRONG = '#F87171'; // the palette's danger red: readable on dark
const DECK_KEY = 'learn.deck';

/**
 * "Learn instead" (from the pause screen): a round of exam-style questions. Enough right answers
 * add a few reels to today's limit. Nothing about it goes to analytics (it's a reels screen).
 */
export function LearnScreen({ route }: Props) {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const app = route.params?.app;
  const decks = learnDecks();
  const [deckId, setDeckId] = useState(() => storage.getString(DECK_KEY) ?? decks[0].id);
  const deck = decks.find((d) => d.id === deckId) ?? decks[0];
  const [round, setRound] = useState(() => makeRound(deck, ROUND, lang));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number>();
  const [results, setResults] = useState<boolean[]>([]);
  const [earned, setEarned] = useState<number | null>(null); // null while the round is on
  const earnedToday = useEarnedToday(useNow());
  const reward = Math.min(EARN_LEARN_REELS, Math.max(0, EARN_CAP - earnedToday));

  const start = (d: Deck) => {
    setRound(makeRound(d, ROUND, lang));
    setIndex(0);
    setPicked(undefined);
    setResults([]);
    setEarned(null);
  };
  const pickDeck = (id: string | undefined) => {
    const d = decks.find((x) => x.id === id);
    if (!d || d.id === deck.id) return;
    storage.set(DECK_KEY, d.id);
    setDeckId(d.id);
    start(d);
  };
  const answer = (k: number) => {
    if (picked !== undefined) return;
    const ok = k === round[index].right;
    void Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    setPicked(k);
    setResults([...results, ok]);
  };
  const next = () => {
    if (index + 1 < round.length) {
      setIndex(index + 1);
      setPicked(undefined);
      return;
    }
    const right = results.filter(Boolean).length;
    setEarned(right >= NEED ? earnReels(EARN_LEARN_REELS) : 0);
  };
  const backToApp = () => {
    if (app) openReelApp(app);
    navigation.dispatch(StackActions.popTo('Main')); // closes this and the pause screen
  };

  const right = results.filter(Boolean).length;
  const question = round[index];

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <View style={s.flex}>
          <AppText variant="title">{t('learn.title')}</AppText>
          <AppText variant="muted">
            {reward > 0 ? t('learn.sub', { need: NEED, total: ROUND, count: reward }) : t('learn.subNoEarn')}
          </AppText>
        </View>
        <IconButton icon="close" label={t('setup.close')} onPress={navigation.goBack} filled />
      </View>

      <ChoiceChips
        options={decks.map((d) => ({ id: d.id, label: txt(d.title, lang) }))}
        value={deck.id}
        onChange={pickDeck}
        clearable={false}
      />
      <AppText variant="caption" style={s.exam}>{txt(deck.exam, lang)}</AppText>

      {earned === null ? (
        <>
          <View style={s.dots}>
            {round.map((_, k) => (
              <View
                key={k}
                style={[
                  s.dot,
                  { backgroundColor: k < results.length ? (results[k] ? LIVE : WRONG) : k === index ? c.accent : c.surfaceAlt },
                ]}
              />
            ))}
          </View>
          <Animated.View key={`${deck.id}-${index}-${round[0]?.q}`} entering={FadeIn.duration(250)}>
            <Card style={s.card}>
              <AppText variant="label">{t('learn.question', { n: index + 1, total: round.length })}</AppText>
              <AppText variant="heading">{question.q}</AppText>
              <View style={s.options}>
                {question.options.map((o, k) => {
                  const isRight = k === question.right;
                  const shown = picked !== undefined;
                  const color = shown && isRight ? LIVE : shown && k === picked ? WRONG : undefined;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => answer(k)}
                      disabled={shown}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: shown, selected: k === picked }}
                      accessibilityHint={shown && isRight ? t('learn.right') : shown && k === picked ? t('learn.wrong') : undefined}
                      style={[
                        s.option,
                        { backgroundColor: color ? withAlpha(color, 0.16) : c.surfaceAlt, borderColor: color ?? 'transparent' },
                        shown && !color && s.dim,
                      ]}
                    >
                      <AppText style={s.optionText}>{o}</AppText>
                      {color && <Ionicons name={isRight ? 'checkmark-circle' : 'close-circle'} size={22} color={color} />}
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </Animated.View>
          {picked !== undefined && (
            <Animated.View entering={FadeIn.duration(200)} style={s.next}>
              <Button label={index + 1 < round.length ? t('learn.next') : t('learn.result')} onPress={next} />
            </Animated.View>
          )}
        </>
      ) : (
        <View style={s.result}>
          <Animated.View entering={ZoomIn.springify()} style={[s.badge, { backgroundColor: c.accentSoft }]}>
            <AppText style={s.score} color={c.accentText}>{`${right}/${round.length}`}</AppText>
          </Animated.View>
          <AppText variant="title" center>{t('learn.score', { right, total: round.length })}</AppText>
          <AppText variant="muted" center>
            {earned > 0 ? t('focus.earned', { count: earned }) : right >= NEED ? t('learn.capped') : t('learn.notEnough', { count: NEED })}
          </AppText>
          <View style={s.buttons}>
            {earned > 0 && app ? <Button label={t('learn.backToApp')} onPress={backToApp} /> : null}
            <Button variant={earned > 0 && app ? 'soft' : 'primary'} label={t('learn.again')} onPress={() => start(deck)} />
            <Button variant="ghost" label={t('learn.close')} onPress={navigation.goBack} />
          </View>
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  exam: { marginTop: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 18 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  card: { gap: 12 },
  options: { gap: 10, marginTop: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  optionText: { flex: 1, fontWeight: '600', fontSize: 16, lineHeight: 22 },
  dim: { opacity: 0.55 },
  next: { marginTop: 16 },
  result: { alignItems: 'center', gap: 10, marginTop: 28 },
  badge: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  score: { fontFamily: fonts.bold, fontSize: 36, lineHeight: 46, includeFontPadding: false },
  buttons: { alignSelf: 'stretch', gap: 6, marginTop: 14 },
});
