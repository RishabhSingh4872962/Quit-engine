import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMMKVString } from 'react-native-mmkv';
import { useTranslation } from 'react-i18next';
import { STAGE_NAMES } from '../lib/companion';
import { formatDuration } from '../lib/format';
import { localDay } from '../lib/reels';
import { storage } from '../lib/storage';
import { useColors } from '../theme';
import { AppText } from './AppText';
import { Card } from './Card';
import { Plant } from './Plant';

/** Minutes of everyone's focus here today for each stage of the room's plant. */
const ROOM_STAGES = [0, 30, 90, 180, 300, 480, 720];

/**
 * "Plant together": the room's plant grows with the focus minutes of everyone here today (from what
 * people already share in rooms; nothing new is stored on the server). The highest total seen today
 * is remembered on this phone, so the plant doesn't shrink when people leave.
 */
export function RoomGarden({ roomId, minutes, now }: { roomId: string; minutes: number; now: number }) {
  const { t } = useTranslation();
  const c = useColors();
  const key = `companion.room.${roomId}`;
  const [raw] = useMMKVString(key, storage);
  const today = localDay(now);
  const seen = parseSeen(raw);
  const total = Math.max(minutes, seen.day === today ? seen.minutes : 0);

  useEffect(() => {
    if (seen.day !== today || total > seen.minutes) storage.set(key, JSON.stringify({ day: today, minutes: total }));
  }, [key, today, total, seen.day, seen.minutes]);

  let stage = 0;
  for (const [i, m] of ROOM_STAGES.entries()) if (total >= m) stage = i;
  const next = ROOM_STAGES[stage + 1] as number | undefined;

  return (
    <View style={s.section}>
      <AppText variant="heading">{t('companion.roomTitle')}</AppText>
      <Card style={s.card}>
        <Plant stage={stage} size={92} />
        <View style={s.text}>
          <AppText style={s.stage} color={c.accentText}>{t(`companion.stages.${STAGE_NAMES[stage]}`)}</AppText>
          <AppText variant="caption">{t('companion.roomSub', { time: formatDuration(total * 60_000, t) })}</AppText>
          {next !== undefined && (
            <AppText variant="caption">{t('companion.roomNext', { time: formatDuration((next - total) * 60_000, t) })}</AppText>
          )}
        </View>
      </Card>
    </View>
  );
}

function parseSeen(raw: string | undefined): { day: string; minutes: number } {
  try {
    const v = raw ? (JSON.parse(raw) as { day?: unknown; minutes?: unknown }) : {};
    return { day: typeof v.day === 'string' ? v.day : '', minutes: typeof v.minutes === 'number' ? v.minutes : 0 };
  } catch {
    return { day: '', minutes: 0 };
  }
}

const s = StyleSheet.create({
  section: { gap: 10, marginTop: 22 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  text: { flex: 1, gap: 4 },
  stage: { fontSize: 17, fontWeight: '700' },
});
