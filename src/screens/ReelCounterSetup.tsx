import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { actions } from '../lib/actions';
import { useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';

type Icon = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Prominent disclosure for the Accessibility Service (Google Play policy): its own screen,
 * says what is read and what isn't, how data is used, and needs an explicit "I agree".
 * Declining is fine: the app keeps working without reel counting.
 */
export function ReelCounterSetupScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const navigation = useNavigation();

  const row = (icon: Icon, text: string, color: string) => (
    <View key={text} style={s.row}>
      <Ionicons name={icon} size={20} color={color} style={s.rowIcon} />
      <AppText style={s.flex}>{text}</AppText>
    </View>
  );

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <IconButton icon="close" label={t('setup.close')} onPress={navigation.goBack} filled />
      </View>

      <Animated.View entering={FadeIn.duration(400)} style={s.hero}>
        <View style={[s.badge, { backgroundColor: c.accentSoft }]}>
          <Ionicons name="film" size={34} color={c.accent} />
        </View>
        <AppText variant="title" center>{t('reels.setupTitle')}</AppText>
        <AppText variant="muted" center>{t('reels.setupIntro')}</AppText>
      </Animated.View>

      <Card style={s.card}>
        <AppText variant="label">{t('reels.readsTitle')}</AppText>
        {row('eye-outline', t('reels.reads1'), c.accent)}
        {row('swap-vertical', t('reels.reads2'), c.accent)}
        {row('school-outline', t('reels.reads3'), c.accent)}
      </Card>

      <Card style={s.card}>
        <AppText variant="label">{t('reels.neverTitle')}</AppText>
        {row('close-circle-outline', t('reels.never1'), c.textMuted)}
        {row('close-circle-outline', t('reels.never2'), c.textMuted)}
        {row('close-circle-outline', t('reels.never3'), c.textMuted)}
      </Card>

      <Card style={s.card}>
        <AppText variant="label">{t('reels.storedTitle')}</AppText>
        {row('lock-closed-outline', t('reels.stored'), c.accent)}
      </Card>

      <AppText variant="caption" style={s.how}>{t('reels.how')}</AppText>

      <Button
        label={t('reels.agree')}
        onPress={() => {
          actions.agreeToReelCounting();
          navigation.goBack();
        }}
      />
      <Button variant="ghost" label={t('reels.notNow')} onPress={navigation.goBack} />
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', minHeight: 40 },
  hero: { alignItems: 'center', gap: 6, marginBottom: 20 },
  badge: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  card: { gap: 12, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowIcon: { marginTop: 2 },
  how: { marginTop: 4, marginBottom: 16, textAlign: 'center' },
});
