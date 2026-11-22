import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { StaticScreenProps, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HABITS } from '../habits';
import { HabitId } from '../habits/types';
import { useLang } from '../i18n';
import { useHabitState } from '../lib/storage';
import { streakDays, useNow } from '../lib/streak';
import { reportError, track } from '../lib/telemetry';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { ShareCard } from '../components/ShareCard';
import { ToggleRow } from '../components/ToggleRow';

type Props = StaticScreenProps<{ habitId: HabitId }>;

/** Preview of the streak image, a privacy toggle, and the system share sheet (WhatsApp, Instagram…). */
export function ShareScreen({ route }: Props) {
  const { t } = useTranslation();
  const lang = useLang();
  const navigation = useNavigation();
  const habit = HABITS[route.params.habitId];
  const state = useHabitState(habit.id);
  const now = useNow();
  const days = streakDays(state.streakStart, now);
  const [showHabit, setShowHabit] = useState(false); // private unless the user chooses otherwise
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<React.ComponentRef<typeof View>>(null);

  const share = async () => {
    setBusy(true);
    try {
      // Captured at the screen's pixel density (about 800×1000 px on most phones), so text stays sharp.
      const uri = await captureRef(cardRef, { format: 'png', result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('share.title') });
      track('streak_shared');
    } catch (e) {
      reportError(e, 'share card');
      Alert.alert(t('share.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <AppText variant="heading">{t('share.title')}</AppText>
        <IconButton icon="close" label={t('setup.close')} onPress={navigation.goBack} filled />
      </View>

      <Animated.View entering={FadeIn.duration(300)} style={s.preview}>
        <ShareCard ref={cardRef} habit={habit} days={days} showHabit={showHabit} lang={lang} />
      </Animated.View>

      <Card>
        <ToggleRow
          title={t('share.showHabit')}
          sub={t('share.showHabitSub')}
          value={showHabit}
          onChange={setShowHabit}
        />
      </Card>
      <Button icon="share-social" label={t('share.button')} onPress={() => void share()} disabled={busy} style={s.button} />
    </Screen>
  );
}

const s = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  preview: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  button: { marginTop: 16 },
});
