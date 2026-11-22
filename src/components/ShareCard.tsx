import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { HabitConfig, Lang } from '../habits/types';
import { mix, withAlpha } from '../lib/color';
import { fonts } from '../theme';

/** 4:5, which suits WhatsApp chats and Instagram posts. */
export const SHARE_CARD = { width: 300, height: 375 };

/**
 * The image people share. The habit name only appears when the user turns it on.
 * Always light text on the habit colour, so it looks the same in light and dark mode.
 */
export function ShareCard({ habit, days, showHabit, lang, ref }: {
  habit: HabitConfig;
  days: number;
  showHabit: boolean;
  lang: Lang;
  ref?: React.Ref<React.ComponentRef<typeof View>>;
}) {
  const { t } = useTranslation();
  const bg = mix(habit.accent, '#000000', 0.18); // a little darker, so white text reads well on every accent
  const glow = mix(habit.accent, '#FFFFFF', 0.25);
  const soft = withAlpha('#FFFFFF', 0.82);

  return (
    // Rounded on screen only: the captured inner View is a full rectangle, so chat apps
    // don't show transparent corners. collapsable={false} keeps it capturable.
    <View style={s.frame}>
      <View ref={ref} collapsable={false} style={[s.card, { backgroundColor: bg }]}>
        <View style={[s.blob, s.blobTop, { backgroundColor: withAlpha(glow, 0.35) }]} />
        <View style={[s.blob, s.blobBottom, { backgroundColor: withAlpha(glow, 0.22) }]} />

        <View style={s.brand}>
          <Ionicons name="leaf" size={16} color={soft} />
          <Text style={[s.brandText, { color: soft }]}>{t('app.name')}</Text>
        </View>

        <View>
          {showHabit && (
            <View style={s.chip}>
              <Ionicons name={habit.icon} size={14} color="#FFFFFF" />
              <Text style={s.chipText}>{habit.name[lang]}</Text>
            </View>
          )}
          <Text style={s.number} adjustsFontSizeToFit numberOfLines={1}>{days}</Text>
          <Text style={s.unit}>{t('common.days', { count: days })}</Text>
          <Text style={[s.counting, { color: soft }]}>{t('share.andCounting')}</Text>
        </View>

        <Text style={[s.tagline, { color: soft }]}>{t('app.tagline')}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  frame: { borderRadius: 28, overflow: 'hidden' },
  card: {
    width: SHARE_CARD.width,
    height: SHARE_CARD.height,
    padding: 26,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  blob: { position: 'absolute', borderRadius: 999 },
  blobTop: { width: 260, height: 260, top: -90, right: -100 },
  blobBottom: { width: 200, height: 200, bottom: -110, left: -70 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, includeFontPadding: false },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: withAlpha('#FFFFFF', 0.2),
    marginBottom: 4,
  },
  chipText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  number: {
    color: '#FFFFFF',
    fontFamily: fonts.display,
    fontSize: 128,
    lineHeight: 136,
    includeFontPadding: false,
  },
  unit: { color: '#FFFFFF', fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, marginTop: -14, includeFontPadding: false },
  counting: { fontSize: 16, lineHeight: 22, marginTop: 2 },
  tagline: { fontSize: 13, lineHeight: 18 },
});
