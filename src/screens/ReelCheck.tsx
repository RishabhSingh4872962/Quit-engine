import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import ReelGuard from '../../modules/reel-guard';
import { HABIT_LIST } from '../habits';
import { openReelApp, useReelCounter } from '../lib/reels';
import { useTracked } from '../lib/storage';
import { LIVE } from '../components/RoomCard';
import { useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';

/**
 * Self-check for the reel counter: note today's counts, swipe a couple of reels in a counted app,
 * come back and see whether they were counted (with fixes if not). Apps change their screens
 * sometimes; this is how a user can tell. Nothing goes to analytics.
 */
export function ReelCheckScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const navigation = useNavigation();
  const tracked = useTracked();
  const all = HABIT_LIST.find((h) => h.reelApps && tracked.includes(h.id))?.reelApps ?? [];
  const [installed] = useState(() => {
    try {
      return new Set(ReelGuard?.installedApps(all.map((a) => a.id)) ?? []);
    } catch {
      return new Set<string>();
    }
  });
  const apps = all.filter((a) => installed.has(a.id));
  const { enabled, stats } = useReelCounter(1); // live: updates on every counted reel and on resume
  const today = stats.at(-1);
  const countOf = (id: string) => today?.apps[id]?.count ?? 0;
  const backupOf = (id: string) => today?.apps[id]?.fallback ?? 0;
  const [base, setBase] = useState<Record<string, { n: number; backup: number }> | null>(null);
  const [back, setBack] = useState(false);

  // Coming back to the app after opening the reels app.
  useEffect(() => {
    if (!base) return;
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setBack(true));
    return () => sub.remove();
  }, [base]);

  const start = (pkg: string) => {
    setBase(Object.fromEntries(all.map((a) => [a.id, { n: countOf(a.id), backup: backupOf(a.id) }])));
    setBack(false);
    openReelApp(pkg);
  };
  const counted = base
    ? all
      .map((a) => ({ app: a, n: countOf(a.id) - (base[a.id]?.n ?? 0), backup: backupOf(a.id) > (base[a.id]?.backup ?? 0) }))
      .filter((d) => d.n > 0)
    : [];

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <AppText variant="title" style={s.flex}>{t('reelCheck.title')}</AppText>
        <IconButton icon="close" label={t('setup.close')} onPress={navigation.goBack} filled />
      </View>
      <AppText variant="muted">{t('reelCheck.intro')}</AppText>

      {!enabled ? (
        <Card style={s.card}>
          <AppText variant="heading">{t('reelCheck.off')}</AppText>
          <Button variant="soft" icon="film-outline" label={t('reels.turnOn')} onPress={() => navigation.navigate('ReelCounterSetup')} />
        </Card>
      ) : (
        <>
          <Card style={s.card}>
            <AppText>{t('reelCheck.step1')}</AppText>
            <AppText>{t('reelCheck.step2')}</AppText>
            <AppText>{t('reelCheck.step3')}</AppText>
            {apps.map((a) => (
              <Button key={a.id} variant="soft" icon="open-outline" label={t('reelCheck.open', { app: a.name })} onPress={() => start(a.id)} />
            ))}
            {apps.length === 0 && <AppText variant="caption">{t('reelCheck.noApps')}</AppText>}
          </Card>

          {base && counted.length > 0 && (
            <Card style={s.card}>
              <View style={s.row}>
                <Ionicons name="checkmark-circle" size={28} color={LIVE} />
                <AppText variant="heading" style={s.flex}>{t('reelCheck.works')}</AppText>
              </View>
              {counted.map((d) => (
                <AppText key={d.app.id}>
                  {t('reelCheck.counted', { count: d.n, app: d.app.name })}
                  {d.backup ? ` ${t('reelCheck.backup')}` : ''}
                </AppText>
              ))}
              <AppText variant="caption">{t('reelCheck.countsToday')}</AppText>
            </Card>
          )}

          {base && counted.length === 0 && (
            <Card style={s.card}>
              <View style={s.row}>
                <Ionicons name={back ? 'alert-circle-outline' : 'time-outline'} size={26} color={back ? c.accentText : c.textMuted} />
                <AppText variant="heading" style={s.flex}>{back ? t('reelCheck.none') : t('reelCheck.waiting')}</AppText>
              </View>
              {back && (
                <>
                  <AppText>{t('reelCheck.tip1')}</AppText>
                  <AppText>{t('reelCheck.tip2')}</AppText>
                  <AppText>{t('reelCheck.tip3')}</AppText>
                </>
              )}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  card: { gap: 10, marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
