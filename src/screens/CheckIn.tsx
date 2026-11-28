import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StaticScreenProps, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HABITS } from '../habits';
import { HabitConfig, HabitId } from '../habits/types';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import { checkInDay, MOOD_NAMES, MOODS, NOTE_MAX, readDays } from '../lib/journal';
import { localDay } from '../lib/reels';
import { confirmSlip } from '../lib/slip';
import { useActiveHabitId, useHabitState, useTracked } from '../lib/storage';
import { useNow } from '../lib/streak';
import { radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconButton } from '../components/IconButton';
import { ChoiceChips, ScalePicker } from '../components/Pickers';
import { Screen } from '../components/Screen';

type Props = StaticScreenProps<{ habitId?: HabitId } | undefined>;

/**
 * Evening check-in: mood, whether the promise was kept, and a private note. Opened from Home, the
 * journal and the daily check-in notification (quitengine://checkin). Everything stays on the phone.
 */
export function CheckInScreen({ route }: Props) {
  const { t } = useTranslation();
  const lang = useLang();
  const navigation = useNavigation();
  const tracked = useTracked();
  const active = useActiveHabitId();
  const now = useNow();
  const [picked, setPicked] = useState<HabitId | undefined>(route.params?.habitId);
  // Several habits: one check-in each, switched here (✓ = done today).
  const [checked, setChecked] = useState(() => new Set(tracked.filter((h) => readDays(h)[checkInDay(now)]?.checkedAt)));
  const id = picked && tracked.includes(picked) ? picked : active;
  if (!id) return null;

  const habits = tracked.map((h) => ({ id: h, label: checked.has(h) ? `${HABITS[h].name[lang]} ✓` : HABITS[h].name[lang] }));

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <AppText variant="title" style={s.flex}>{t('journal.checkInTitle')}</AppText>
        <IconButton icon="close" label={t('setup.close')} onPress={navigation.goBack} filled />
      </View>
      {habits.length > 1 && (
        <View style={s.habits}>
          <ChoiceChips options={habits} value={id} onChange={(h) => h && setPicked(h)} clearable={false} />
        </View>
      )}
      <CheckInForm
        key={id}
        habit={HABITS[id]}
        now={now}
        onSaved={() => setChecked((prev) => new Set(prev).add(id))}
        onClose={navigation.goBack}
      />
    </Screen>
  );
}

function CheckInForm({ habit, now, onSaved, onClose }: {
  habit: HabitConfig; now: number; onSaved: () => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const state = useHabitState(habit.id);
  const [saved] = useState(() => readDays(habit.id)[checkInDay(now)]); // editing today's check-in
  const [mood, setMood] = useState(saved?.mood);
  const [kept, setKept] = useState(saved?.kept);
  const [note, setNote] = useState(saved?.note ?? '');
  const [done, setDone] = useState(false);
  const promise = habit.pledge?.[lang] ?? t('journal.pledgeFallback');

  const save = () => {
    actions.checkIn(habit.id, { mood, kept, note });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDone(true);
    onSaved();
  };

  if (done) {
    // A streak started today (e.g. after an automatic reel-limit slip) has nothing to reset.
    const canSlip = kept === false && state.streakStart !== null && localDay(state.streakStart) < checkInDay(now);
    return (
      <View style={s.done}>
        <Animated.View entering={ZoomIn.springify()} style={[s.badge, { backgroundColor: c.accentSoft, borderColor: c.glow, boxShadow: `0px 0px 48px ${c.glow}` }]}>
          {mood ? <AppText style={s.badgeEmoji}>{MOODS[mood - 1]}</AppText> : <Ionicons name="checkmark" size={48} color={c.accent} />}
        </Animated.View>
        <Animated.View entering={FadeIn.delay(150)} style={s.doneText}>
          <AppText variant="title" center>{kept === false ? t('journal.doneNotKeptTitle') : t('journal.doneTitle')}</AppText>
          <AppText variant="muted" center>{kept === false ? t('journal.doneNotKept') : t('journal.doneKept')}</AppText>
        </Animated.View>
        <Button label={t('journal.done')} onPress={onClose} style={s.stretch} />
        {canSlip && <Button variant="ghost" label={t('home.slipped')} onPress={() => confirmSlip(habit.id, t, onClose)} style={s.stretch} />}
      </View>
    );
  }

  const keptOptions = [
    { id: 'yes' as const, label: t('journal.yes') },
    { id: 'no' as const, label: t('journal.notFully') },
  ];

  return (
    <View style={s.form}>
      <Card style={s.card}>
        <AppText variant="heading">{t('journal.moodAsk')}</AppText>
        <ScalePicker big labels={MOODS} a11y={(n) => t(`journal.moods.${MOOD_NAMES[n - 1]}`)} value={mood} onChange={setMood} />
        {mood !== undefined && <AppText variant="caption" center>{t(`journal.moods.${MOOD_NAMES[mood - 1]}`)}</AppText>}
      </Card>

      <Card style={s.card}>
        <AppText variant="heading">{t('journal.keptAsk')}</AppText>
        <AppText variant="muted">{promise}</AppText>
        <ChoiceChips
          options={keptOptions}
          value={kept === undefined ? undefined : kept ? 'yes' : 'no'}
          onChange={(v) => setKept(v === undefined ? undefined : v === 'yes')}
        />
      </Card>

      <Card style={s.card}>
        <AppText variant="heading">{t('journal.note')}</AppText>
        <TextField
          value={note}
          onChangeText={(v) => setNote(v.slice(0, NOTE_MAX))}
          placeholder={t('journal.notePlaceholder')}
          placeholderTextColor={c.textMuted}
          maxLength={NOTE_MAX}
          multiline
          textAlignVertical="top"
          style={s.input}
          accessibilityLabel={t('journal.note')}
        />
        <AppText variant="caption">{t('journal.noteHint')}</AppText>
      </Card>

      <Button
        label={t('journal.save')}
        onPress={save}
        disabled={mood === undefined && kept === undefined && !note.trim()}
      />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  habits: { marginBottom: 14 },
  form: { gap: 14 },
  card: { gap: 12 },
  input: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, lineHeight: 22, minHeight: 96 },
  done: { alignItems: 'center', gap: 16, paddingTop: 48 },
  badge: { width: 120, height: 120, borderRadius: 60, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  badgeEmoji: { fontSize: 56, lineHeight: 68 },
  doneText: { gap: 6, marginBottom: 12 },
  stretch: { alignSelf: 'stretch' },
});
