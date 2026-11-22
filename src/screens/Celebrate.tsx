import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StackActions, StaticScreenProps, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HABITS } from '../habits';
import { HabitId } from '../habits/types';
import { milestoneLabel, useLang } from '../i18n';
import { mix } from '../lib/color';
import { radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Burst } from '../components/Burst';
import { Button } from '../components/Button';

type Props = StaticScreenProps<{ habitId: HabitId; days: number }>;

/** Shown over Home the first time a milestone is reached. */
export function CelebrateScreen({ route }: Props) {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const habit = HABITS[route.params.habitId];

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(250)} style={s.backdrop}>
      <Animated.View entering={ZoomIn.springify().damping(20)} style={[s.card, { backgroundColor: c.surface }]}>
        <View style={s.badgeWrap}>
          <Burst colors={[c.accent, mix(c.accent, '#FFD166', 0.6), '#FFD166', c.accentSoft]} />
          <View style={[s.badge, { backgroundColor: c.accent }]}>
            <Ionicons name="trophy" size={52} color={c.onAccent} />
          </View>
        </View>
        <AppText variant="label" center>{habit.name[lang]} · {t('celebrate.reached')}</AppText>
        <AppText variant="title" center style={s.label} color={c.accentText}>{milestoneLabel(route.params.days, t)}</AppText>
        <AppText variant="muted" center style={s.body}>{t('celebrate.body')}</AppText>
        <Button label={t('celebrate.keepGoing')} onPress={navigation.goBack} style={s.button} />
        <Button
          variant="ghost"
          icon="share-social-outline"
          label={t('share.button')}
          onPress={() => navigation.dispatch(StackActions.replace('Share', { habitId: habit.id }))}
          style={s.share}
        />
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10, 8, 20, 0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, borderRadius: radius.lg + 4, padding: 28, alignItems: 'center' },
  badgeWrap: { width: 200, height: 170, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 36, lineHeight: 46, marginTop: 4 },
  body: { marginTop: 6, marginBottom: 24 },
  button: { alignSelf: 'stretch' },
  share: { alignSelf: 'stretch', marginTop: 4 },
});
