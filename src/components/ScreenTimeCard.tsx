import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import { DayUsage, openUsageAccessSettings, useScreenTime } from '../lib/screenTime';
import { useScreenTimeOff } from '../lib/storage';
import { fonts, radius, useColors } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { ToggleRow } from './ToggleRow';

type App = { id: string; name: string };

const HOUR = 3_600_000;

/** 72 min -> "1h 12m", 5 min -> "5m" (localised). */
function formatDuration(ms: number, t: TFunction) {
  const mins = Math.round(ms / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? t('screenTime.hm', { h, m }) : t('screenTime.m', { m });
}

/** Today's time in the habit's apps, last week's average and a 7-day chart (Android). */
export function ScreenTimeCard({ apps }: { apps: App[] }) {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const off = useScreenTimeOff();
  const { access, usage } = useScreenTime(apps.map((a) => a.id));
  const [showApps, setShowApps] = useState(false);

  const header = (
    <View style={s.header}>
      <View style={[s.icon, { backgroundColor: c.accentSoft }]}>
        <Ionicons name="time" size={18} color={c.accent} />
      </View>
      <AppText variant="heading">{t('screenTime.title')}</AppText>
    </View>
  );
  const privacy = (
    <View style={s.privacy}>
      <Ionicons name="lock-closed" size={13} color={c.textMuted} />
      <AppText variant="caption">{t('screenTime.private')}</AppText>
    </View>
  );

  if (!access) {
    return (
      <Card style={s.card}>
        {header}
        <AppText variant="muted">{t('screenTime.intro')}</AppText>
        <Button variant="soft" icon="lock-open-outline" label={t('screenTime.allow')} onPress={openUsageAccessSettings} />
        {privacy}
      </Card>
    );
  }
  if (!usage) return <Card style={s.card}>{header}</Card>; // first read takes a moment

  const counted = (d: DayUsage) => apps.reduce((sum, a) => (off.includes(a.id) ? sum : sum + (d.byApp[a.id] ?? 0)), 0);
  const totals = usage.map(counted);
  const today = totals[totals.length - 1];
  const before = totals.slice(0, -1); // full days before today
  const average = before.reduce((a, b) => a + b, 0) / Math.max(1, before.length);
  const week = usage.slice(-7);
  const scale = Math.max(HOUR, ...week.map(counted)); // bars never look huge for a few minutes
  const appWeek = (id: string) => week.reduce((sum, d) => sum + (d.byApp[id] ?? 0), 0);
  const listed = apps.filter((a) => off.includes(a.id) || usage.some((d) => (d.byApp[a.id] ?? 0) > 0));
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';

  return (
    <Card style={s.card}>
      {header}

      <View>
        <AppText variant="label">{t('screenTime.today')}</AppText>
        <AppText style={s.today} color={c.accentText}>{formatDuration(today, t)}</AppText>
        <AppText variant="caption">{t('screenTime.average', { time: formatDuration(average, t) })}</AppText>
      </View>

      <View style={s.chart}>
        {week.map((d, i) => {
          const ms = counted(d);
          const isToday = i === week.length - 1;
          const date = new Date(d.start);
          return (
            <View
              key={d.start}
              style={s.column}
              accessible
              accessibilityLabel={`${date.toLocaleDateString(locale, { weekday: 'long' })}: ${formatDuration(ms, t)}`}
            >
              <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
                <View
                  style={[
                    s.bar,
                    { height: `${Math.max(3, (ms / scale) * 100)}%`, backgroundColor: isToday ? c.accent : c.accentSoft },
                  ]}
                />
              </View>
              <AppText variant="caption" color={isToday ? c.accentText : undefined}>
                {date.toLocaleDateString(locale, { weekday: 'narrow' })}
              </AppText>
            </View>
          );
        })}
      </View>

      <Pressable
        onPress={() => setShowApps((v) => !v)}
        style={s.appsToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: showApps }}
      >
        <AppText style={s.appsTitle}>{t('screenTime.apps')}</AppText>
        <Ionicons name={showApps ? 'chevron-up' : 'chevron-down'} size={18} color={c.textMuted} />
      </Pressable>
      {showApps &&
        (listed.length ? (
          listed.map((a) => (
            <ToggleRow
              key={a.id}
              title={a.name}
              sub={t('screenTime.lastWeek', { time: formatDuration(appWeek(a.id), t) })}
              value={!off.includes(a.id)}
              onChange={(on) => actions.setScreenTimeApp(a.id, on)}
            />
          ))
        ) : (
          <AppText variant="caption">{t('screenTime.noUsage')}</AppText>
        ))}

      {privacy}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  today: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 44, includeFontPadding: false, marginTop: 2 },
  chart: { flexDirection: 'row', gap: 8 },
  column: { flex: 1, alignItems: 'center', gap: 6 },
  track: { width: '100%', height: 80, borderRadius: radius.sm, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: radius.sm },
  appsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  appsTitle: { fontSize: 16, fontWeight: '600' },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
