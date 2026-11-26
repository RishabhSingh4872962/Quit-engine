import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { Lang } from '../habits/types';
import { useLang } from '../i18n';
import { formatDuration } from '../lib/format';
import { Room, roomPhase } from '../lib/rooms';
import { radius, useColors } from '../theme';
import { AppText } from './AppText';
import { Card } from './Card';

/** Green for "live" dots and chips; readable on both themes. */
export const LIVE = '#2EBD6B';

export const roomTitle = (room: Pick<Room, 'name' | 'hi'>, lang: Lang) => (lang === 'hi' && room.hi) || room.name;

/** Small pill label (tags, LIVE). */
export function Chip({ text, color, solid }: { text: string; color?: string; solid?: boolean }) {
  const c = useColors();
  const fg = color ?? c.accentText;
  return (
    <View style={[s.chip, { backgroundColor: solid ? fg : c.accentSoft }]}>
      <AppText style={s.chipText} color={solid ? '#FFFFFF' : fg}>{text}</AppText>
    </View>
  );
}

/** One room in a list: tag, people here, and where its shared timer is. */
export function RoomCard({ room, count, now, onPress, live }: {
  room: Room; count: number; now: number; onPress: () => void; live?: boolean;
}) {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const phase = roomPhase(room, now);
  const title = roomTitle(room, lang);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => pressed && s.pressed}>
      <Card style={s.card}>
        <View style={s.top}>
          {live && <Chip text={t('rooms.live')} color={LIVE} solid />}
          <Chip text={t(`rooms.tags.${room.tag}`)} />
          {room.quiet && <Ionicons name="volume-mute-outline" size={16} color={c.textMuted} />}
          {room.hidden && <Ionicons name="lock-closed-outline" size={15} color={c.textMuted} />}
          <View style={s.flex} />
          <View style={[s.dot, { backgroundColor: count > 0 ? LIVE : c.textMuted }]} />
          <AppText variant="caption">{t('rooms.here', { count })}</AppText>
        </View>
        <AppText variant="heading" numberOfLines={1}>{title}</AppText>
        <AppText variant="caption">
          {!phase
            ? t('rooms.ownTimer')
            : phase.phase === 'focus'
              ? t('rooms.focusLeft', { time: formatDuration(phase.left, t) })
              : t('rooms.breakLeft', { time: formatDuration(phase.left, t) })}
        </AppText>
        {phase && (
          <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
            <View
              style={[
                s.fill,
                { width: `${(1 - phase.left / phase.total) * 100}%`, backgroundColor: phase.phase === 'focus' ? c.accent : LIVE },
              ]}
            />
          </View>
        )}
      </Card>
    </Pressable>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  card: { gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  chipText: { fontSize: 12, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  track: { height: 5, borderRadius: radius.pill, overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%', borderRadius: radius.pill },
});
