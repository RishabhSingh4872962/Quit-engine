import React from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { formatDuration } from '../lib/format';
import { dayTotals, useReelCounter } from '../lib/reels';
import { fonts, useColors } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';

type App = { id: string; name: string };

/** Today's reel count and time (free). Before setup it explains and links to the disclosure. */
export function ReelsTodayCard({ apps }: { apps: App[] }) {
  const { t } = useTranslation();
  const c = useColors();
  const navigation = useNavigation();
  const { enabled, stats } = useReelCounter(1);
  const today = stats[stats.length - 1];
  const total = dayTotals(today, apps.map((a) => a.id));
  const used = apps.filter((a) => (today?.apps[a.id]?.count ?? 0) > 0);

  return (
    <Card style={s.card}>
      <View style={s.header}>
        <View style={[s.icon, { backgroundColor: c.accentSoft }]}>
          <Ionicons name="film" size={18} color={c.accent} />
        </View>
        <AppText variant="heading">{t('reels.title')}</AppText>
      </View>

      {!enabled ? (
        <>
          <AppText variant="muted">{t('reels.pitch')}</AppText>
          <Button variant="soft" icon="film-outline" label={t('reels.turnOn')} onPress={() => navigation.navigate('ReelCounterSetup')} />
        </>
      ) : (
        <>
          <View>
            <AppText style={s.count} color={c.accentText}>{t('reels.count', { count: total.count })}</AppText>
            <AppText variant="caption">
              {total.count > 0 ? t('reels.time', { time: formatDuration(total.ms, t) }) : t('reels.none')}
            </AppText>
          </View>
          {used.map((a) => {
            const app = today?.apps[a.id];
            return (
              <View key={a.id} style={s.appRow}>
                <AppText style={s.appName}>{a.name}</AppText>
                <AppText variant="muted">
                  {t('reels.appLine', { count: app?.count ?? 0, time: formatDuration(app?.ms ?? 0, t) })}
                </AppText>
              </View>
            );
          })}
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 44, includeFontPadding: false },
  appRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appName: { fontSize: 16, fontWeight: '600' },
});
