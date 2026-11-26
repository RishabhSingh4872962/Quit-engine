import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  findRoomByCode,
  Room,
  useCurrentRoom,
  useInviteRoomIds,
  useMyRoomIds,
  useRoom,
  useRoomCounts,
  useRoomProfile,
  useRooms,
  roomsUid,
  useRoomsUid,
} from '../lib/rooms';
import { reportError } from '../lib/telemetry';
import { useNow } from '../lib/streak';
import { avatarEmoji, RoomKind, ROOM_KINDS } from '../rooms/data';
import { radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { RoomCard } from '../components/RoomCard';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';

/**
 * Rooms tab: study, silent, people and custom rooms. Listens to the database only while this tab is
 * on screen (fewer connections), and never shows anything about anyone's habits.
 */
export function RoomsScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const navigation = useNavigation();
  const focused = useIsFocused();
  const uid = useRoomsUid();
  // Rooms can only be read signed in; an anonymous account (no email, no name) is made on first visit.
  useEffect(() => {
    if (focused && !uid) roomsUid().catch((e) => reportError(e, 'rooms sign-in'));
  }, [focused, uid]);
  const live = focused && uid !== null;
  const profile = useRoomProfile(uid);
  const rooms = useRooms(live);
  const counts = useRoomCounts(live);
  const current = useCurrentRoom();
  const myIds = useMyRoomIds(live ? uid : null);
  const inviteIds = useInviteRoomIds();
  const now = useNow(30_000);
  const [kind, setKind] = useState<RoomKind>('study');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const open = (r: { id: string; hidden: boolean }) => navigation.navigate('Room', { id: r.id, hidden: r.hidden });
  const count = (id: string) => Math.max(0, counts[id] ?? 0);

  const list = (rooms ?? [])
    .filter((r) => r.kind === kind && !(kind === 'custom' && myIds.includes(r.id)))
    .sort((a, b) => (kind === 'custom' ? count(b.id) - count(a.id) : a.order - b.order));
  const busiest = (rooms ?? []).reduce<Room | null>((best, r) => (count(r.id) > (best ? count(best.id) : 0) ? r : best), null);
  const kindOptions = ROOM_KINDS.map((k) => ({ value: k, label: t(`rooms.kinds.${k}`) }));

  const joinWithCode = async () => {
    if (busy || !code.trim()) return;
    setBusy(true);
    try {
      const id = await findRoomByCode(code);
      if (!id) return Alert.alert(t('rooms.joinCode'), t('rooms.codeNotFound'));
      setCode('');
      open({ id, hidden: true });
    } catch (e) {
      reportError(e, 'join with code');
      Alert.alert(t('rooms.joinCode'), t('rooms.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={s.header}>
        <View style={s.flex}>
          <AppText variant="title">{t('rooms.title')}</AppText>
          <AppText variant="muted">{t('rooms.sub')}</AppText>
        </View>
        {profile && (
          <Pressable
            onPress={() => navigation.navigate('RoomProfile')}
            style={[s.me, { backgroundColor: c.accentSoft }]}
            accessibilityRole="button"
            accessibilityLabel={t('rooms.editProfile')}
          >
            <AppText style={s.meEmoji}>{avatarEmoji(profile.avatar)}</AppText>
          </Pressable>
        )}
      </View>

      {profile === null && (
        <Card style={s.card}>
          <AppText variant="heading">{t('rooms.setupTitle')}</AppText>
          <AppText variant="muted">{t('rooms.setupBody')}</AppText>
          <Button icon="person-add-outline" label={t('rooms.getStarted')} onPress={() => navigation.navigate('RoomProfile')} />
        </Card>
      )}

      {current && (
        <View style={s.section}>
          <AppText variant="label">{t('rooms.youreIn')}</AppText>
          <RoomById id={current.id} hidden={current.hidden} count={count(current.id)} now={now} onPress={open} />
        </View>
      )}

      {busiest && busiest.id !== current?.id && (
        <View style={s.section}>
          <AppText variant="label">{t('rooms.liveNow')}</AppText>
          <RoomCard room={busiest} count={count(busiest.id)} now={now} onPress={() => open(busiest)} live />
        </View>
      )}

      <View style={s.section}>
        <Segmented options={kindOptions} value={kind} onChange={setKind} />
        <AppText variant="caption" style={s.kindSub}>{t(`rooms.kindSub.${kind}`)}</AppText>
      </View>

      {kind === 'custom' && profile && (
        <Card style={s.card}>
          <Button icon="add" label={t('rooms.create')} onPress={() => navigation.navigate('CreateRoom')} />
          <View style={s.codeRow}>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              onSubmitEditing={() => void joinWithCode()}
              placeholder={t('rooms.codePlaceholder')}
              placeholderTextColor={c.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={[s.input, { color: c.text, backgroundColor: c.surfaceAlt }]}
              accessibilityLabel={t('rooms.joinCode')}
            />
            <Button variant="soft" label={t('rooms.joinCode')} onPress={() => void joinWithCode()} disabled={busy || code.length !== 6} style={s.codeButton} />
          </View>
        </Card>
      )}

      {kind === 'custom' && myIds.length > 0 && (
        <View style={s.section}>
          <AppText variant="label">{t('rooms.yourRooms')}</AppText>
          {myIds.map((id) => (
            <MyRoom key={id} id={id} rooms={rooms} count={count(id)} now={now} onPress={open} />
          ))}
        </View>
      )}

      {kind === 'custom' && inviteIds.filter((id) => !myIds.includes(id)).length > 0 && (
        <View style={s.section}>
          <AppText variant="label">{t('rooms.savedRooms')}</AppText>
          {inviteIds.filter((id) => !myIds.includes(id)).map((id) => (
            <RoomById key={id} id={id} hidden count={count(id)} now={now} onPress={open} />
          ))}
        </View>
      )}

      <View style={s.list}>
        {list.map((r) => (
          <RoomCard key={r.id} room={r} count={count(r.id)} now={now} onPress={() => open(r)} />
        ))}
      </View>

      {!rooms && <Ionicons name="ellipsis-horizontal" size={28} color={c.textMuted} style={s.loading} />}
    </Screen>
  );
}

/** A room loaded by id (invite-only rooms aren't in the public list). Renders nothing if it's gone. */
function RoomById({ id, hidden, count, now, onPress }: {
  id: string; hidden: boolean; count: number; now: number; onPress: (r: { id: string; hidden: boolean }) => void;
}) {
  const room = useRoom(id, hidden);
  if (!room) return null;
  return <RoomCard room={room} count={count} now={now} onPress={() => onPress(room)} />;
}

/** A room I created: public ones come from the list, invite-only ones are loaded by id. */
function MyRoom({ id, rooms, count, now, onPress }: {
  id: string; rooms: Room[] | undefined; count: number; now: number; onPress: (r: { id: string; hidden: boolean }) => void;
}) {
  const pub = rooms?.find((r) => r.id === id);
  if (pub) return <RoomCard room={pub} count={count} now={now} onPress={() => onPress(pub)} />;
  return <RoomById id={id} hidden count={count} now={now} onPress={onPress} />;
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  me: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  meEmoji: { fontSize: 24, lineHeight: 30 },
  card: { gap: 12, marginTop: 14 },
  section: { gap: 8, marginTop: 18 },
  kindSub: { marginTop: 2 },
  list: { gap: 12, marginTop: 12 },
  codeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 18, letterSpacing: 3, fontWeight: '700' },
  codeButton: { flex: 1.4 },
  loading: { alignSelf: 'center', marginTop: 24 },
});
