import React, { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StackActions, StaticScreenProps, useNavigation } from '@react-navigation/native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import { focusEnd, mySubjects, sessionMode, useFocusPrefs, useFocusSession } from '../lib/focus';
import { clock, formatDuration } from '../lib/format';
import { callsAvailable } from '../lib/calls';
import { usePremium } from '../lib/premium';
import { useReelCounter } from '../lib/reels';
import {
  BoardRow,
  deleteRoom,
  enterRoom,
  FeedItem,
  forgetInviteRoom,
  hidePerson,
  highFive,
  leaveRoom,
  Member,
  periodKey,
  reportInRoom,
  roomPhase,
  roomSession,
  useBoard,
  useCurrentRoom,
  useFeed,
  useHiddenPeople,
  useMembers,
  useRoom,
  useRoomProfile,
  useRoomsUid,
} from '../lib/rooms';
import { useNow } from '../lib/streak';
import { reportError } from '../lib/telemetry';
import { avatarEmoji, Subject } from '../rooms/data';
import { fonts, radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { CallPanel } from '../components/CallPanel';
import { Card } from '../components/Card';
import { IconButton } from '../components/IconButton';
import { ChoiceChips } from '../components/Pickers';
import { Chip, LIVE, roomTitle } from '../components/RoomCard';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';

type Props = StaticScreenProps<{ id: string; hidden?: boolean }>;

/** One room: its shared timer, who's here, finished sessions with high fives, and the leaderboard. */
export function RoomScreen({ route }: Props) {
  const { id, hidden = false } = route.params;
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const room = useRoom(id, hidden);
  const uid = useRoomsUid();
  const profile = useRoomProfile(uid);
  const current = useCurrentRoom();
  const inRoom = current?.id === id;
  const now = useNow(1000);
  const members = useMembers(id, now);
  const hiddenPeople = useHiddenPeople();
  const session = useFocusSession();
  const prefs = useFocusPrefs();
  const premium = usePremium();
  const { enabled: counterOn } = useReelCounter(1);
  const [busy, setBusy] = useState(false);

  if (room === null) {
    // Deleted (or a stale invite): nothing to show.
    return (
      <Screen edges={['top', 'bottom']}>
        <IconButton icon="chevron-back" label={t('rooms.back')} onPress={navigation.goBack} filled />
        <AppText variant="muted" center style={s.gone}>{t('rooms.codeNotFound')}</AppText>
        {hidden && <Button variant="ghost" label={t('rooms.leave')} onPress={() => { forgetInviteRoom(id); navigation.goBack(); }} />}
      </Screen>
    );
  }

  const phase = room ? roomPhase(room, now) : null;
  const visible = (members ?? []).filter((m) => !hiddenPeople.includes(m.uid));
  const focusing = visible.filter((m) => m.state === 'focus').length;
  const sessionLeft = session ? focusEnd(session) - now : 0;
  const stopwatch = session ? sessionMode(session) === 'stopwatch' : false;
  const mine = room?.owner !== '' && room?.owner === uid;
  const inviteCode = room?.code;

  const run = async (what: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      reportError(e, what);
      Alert.alert(t('rooms.title'), t('rooms.error'));
    } finally {
      setBusy(false);
    }
  };

  const join = () => {
    if (!profile) return navigation.navigate('RoomProfile', { join: { id, hidden } });
    void run('enter room', () => enterRoom(id, hidden));
  };
  const focusWithRoom = () => {
    if (!room) return;
    const { minutes, endsAt } = roomSession(room, now, prefs.minutes);
    actions.startFocus({ mode: 'timer', minutes }, premium && counterOn && prefs.blockReels, { endsAt });
  };

  const menu = () => {
    if (!room) return;
    const options: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];
    if (room.kind === 'custom' && !mine) {
      options.push({ text: t('rooms.reportName'), onPress: () => { reportInRoom(id, 'name'); Alert.alert(t('rooms.reported')); } });
    }
    if (mine) {
      options.push({
        text: t('rooms.deleteRoom'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(t('rooms.deleteRoomTitle'), t('rooms.deleteRoomBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('rooms.deleteConfirm'), style: 'destructive', onPress: () => void run('delete room', async () => { await deleteRoom(room); navigation.goBack(); }) },
          ]),
      });
    }
    if (inRoom) options.push({ text: t('rooms.leave'), onPress: () => void run('leave room', leaveRoom) });
    options.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(roomTitle(room, lang), undefined, options);
  };

  const memberMenu = (m: Member) => {
    if (m.uid === uid) return;
    Alert.alert(m.nick, undefined, [
      { text: t('rooms.reportNick'), onPress: () => { reportInRoom(id, 'nick', m.uid); Alert.alert(t('rooms.reported')); } },
      { text: t('rooms.hidePerson'), style: 'destructive', onPress: () => hidePerson(m.uid) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <IconButton icon="chevron-back" label={t('rooms.back')} onPress={navigation.goBack} filled />
        <View style={s.flex}>
          <AppText variant="heading" numberOfLines={1}>{room ? roomTitle(room, lang) : ''}</AppText>
          {room && (
            <View style={s.chips}>
              <Chip text={t(`rooms.tags.${room.tag}`)} />
              {room.quiet && <Ionicons name="volume-mute-outline" size={16} color={c.textMuted} />}
              {room.hidden && <Ionicons name="lock-closed-outline" size={15} color={c.textMuted} />}
            </View>
          )}
        </View>
        <IconButton icon="ellipsis-horizontal" label={t('rooms.menu')} onPress={menu} filled />
      </View>

      <Card style={s.statusCard}>
        <View style={s.statusTop}>
          <Chip text={t('rooms.live')} color={LIVE} solid />
          <AppText variant="caption">
            {t('rooms.here', { count: visible.length })} · {t('rooms.focusingCount', { count: focusing })}
          </AppText>
        </View>
        {phase ? (
          <>
            <AppText style={s.bigClock} color={phase.phase === 'focus' ? c.accentText : LIVE}>{clock(phase.left)}</AppText>
            <AppText variant="muted">
              {phase.phase === 'focus'
                ? t('rooms.focusLeft', { time: formatDuration(phase.left, t) })
                : t('rooms.breakLeft', { time: formatDuration(phase.left, t) })}
            </AppText>
            <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
              <View
                style={[
                  s.fill,
                  { width: `${(1 - phase.left / phase.total) * 100}%`, backgroundColor: phase.phase === 'focus' ? c.accent : LIVE },
                ]}
              />
            </View>
            {room && <AppText variant="caption">{t('rooms.timer', { focus: room.focus, brk: room.brk })}</AppText>}
          </>
        ) : (
          <AppText variant="muted">{t('rooms.ownTimer')}</AppText>
        )}

        {!inRoom ? (
          <Button icon="enter-outline" label={t('rooms.join')} onPress={join} disabled={busy || !room} />
        ) : session && sessionLeft > 0 ? (
          <>
            <Button icon="timer-outline" variant="soft" label={stopwatch && session ? t('rooms.focusingSoFar', { time: clock(now - session.startedAt) }) : t('rooms.focusing', { time: clock(sessionLeft) })} onPress={() => navigation.dispatch(StackActions.popTo('Main', { screen: 'Focus' }))} />
          </>
        ) : (
          room && (
            <Button
              icon="play"
              label={
                phase
                  ? t('rooms.focusWith', { count: roomSession(room, now, prefs.minutes).minutes })
                  : t('rooms.focusOwn', { count: prefs.minutes })
              }
              onPress={focusWithRoom}
            />
          )
        )}
        {inRoom && <Button variant="ghost" label={t('rooms.leave')} onPress={() => void run('leave room', leaveRoom)} disabled={busy} />}
        {room?.quiet && <AppText variant="caption" center>{room.strict ? t('rooms.strictNote') : t('rooms.quietNote')}</AppText>}
      </Card>

      {inviteCode && (
        <Card style={s.inviteCard}>
          <AppText style={s.code}>{t('rooms.inviteCode', { code: inviteCode })}</AppText>
          <Button
            variant="soft"
            icon="share-social-outline"
            label={t('rooms.shareInvite')}
            onPress={() => void Share.share({ message: t('rooms.inviteMessage', { code: inviteCode }) })}
          />
        </Card>
      )}

      {room?.hidden && inRoom && callsAvailable && <CallPanel roomId={id} />}

      <View style={s.section}>
        <AppText variant="heading">{t('rooms.hereNow')}</AppText>
        {members && visible.length === 0 && <AppText variant="muted">{t('rooms.nobody')}</AppText>}
        <View style={s.grid}>
          {visible.map((m) => (
            <MemberTile key={m.uid} m={m} me={m.uid === uid} now={now} onLongPress={() => memberMenu(m)} />
          ))}
        </View>
      </View>

      {room && !room.quiet && <Feed roomId={id} uid={uid} now={now} hiddenPeople={hiddenPeople} />}

      <Leaderboard roomId={id} uid={uid} optedIn={profile?.board === true} hiddenPeople={hiddenPeople} now={now} />
    </Screen>
  );
}

function MemberTile({ m, me, now, onLongPress }: { m: Member; me: boolean; now: number; onLongPress: () => void }) {
  const { t } = useTranslation();
  const c = useColors();
  const focusingNow = m.state === 'focus';
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[s.tile, { backgroundColor: me ? c.accentSoft : c.surface, borderColor: c.border }]}
      accessibilityLabel={m.nick}
    >
      <View style={s.tileTop}>
        <View style={[s.avatar, { backgroundColor: c.surfaceAlt }]}>
          <AppText style={s.avatarEmoji}>{avatarEmoji(m.avatar)}</AppText>
          {m.conn && <View style={[s.liveDot, { borderColor: c.surface }]} />}
        </View>
        {m.tag && <Chip text={t(`rooms.tags.${m.tag}`)} />}
      </View>
      <AppText style={s.nick} numberOfLines={1}>{me ? `${m.nick} (${t('rooms.you')})` : m.nick}</AppText>
      <AppText variant="caption" color={focusingNow ? c.accentText : undefined}>
        {!focusingNow
          ? t('rooms.memberHere')
          : m.ends
            ? `⏱ ${t('rooms.memberLeft', { time: formatDuration(m.ends - now, t) })}`
            : `⏱ ${t('rooms.memberSoFar', { time: formatDuration(now - m.since, t) })}`}
      </AppText>
      {m.today > 0 && <AppText variant="caption">{t('rooms.memberToday', { time: formatDuration(m.today * 60_000, t) })}</AppText>}
    </Pressable>
  );
}

function ago(at: number, now: number, t: TFunction) {
  const min = Math.floor((now - at) / 60_000);
  if (min < 1) return t('rooms.agoNow');
  if (min < 60) return t('rooms.agoMin', { count: min });
  if (min < 1440) return t('rooms.agoHour', { count: Math.floor(min / 60) });
  return t('rooms.agoDay', { count: Math.floor(min / 1440) });
}

function Feed({ roomId, uid, now, hiddenPeople }: { roomId: string; uid: string | null; now: number; hiddenPeople: string[] }) {
  const { t } = useTranslation();
  const c = useColors();
  const feed = useFeed(roomId, true);
  const items = (feed ?? []).filter((f) => !hiddenPeople.includes(f.uid));
  return (
    <View style={s.section}>
      <AppText variant="heading">{t('rooms.feedTitle')}</AppText>
      {feed && items.length === 0 && <AppText variant="muted">{t('rooms.feedEmpty')}</AppText>}
      {items.map((f: FeedItem) => {
        const fived = uid ? f.fives.includes(uid) : false;
        const own = f.uid === uid;
        return (
          <Card key={f.id} style={s.feedRow}>
            <AppText style={s.feedEmoji}>{avatarEmoji(f.avatar)}</AppText>
            <View style={s.flex}>
              <AppText>
                <AppText style={s.nick}>{f.nick}</AppText> {t('rooms.feedItem', { count: f.min })}
              </AppText>
              <AppText variant="caption">{ago(f.at, now, t)}</AppText>
            </View>
            <Pressable
              onPress={() => highFive(roomId, f.id)}
              disabled={own || fived || !uid}
              style={[s.five, { backgroundColor: fived ? c.accent : c.accentSoft, opacity: own ? 0.6 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={t('rooms.highFive')}
              accessibilityState={{ selected: fived }}
            >
              <AppText style={s.fiveText} color={fived ? c.onAccent : c.accentText}>🙌 {f.fives.length || ''}</AppText>
            </Pressable>
          </Card>
        );
      })}
    </View>
  );
}

function Leaderboard({ roomId, uid, optedIn, hiddenPeople, now }: {
  roomId: string; uid: string | null; optedIn: boolean; hiddenPeople: string[]; now: number;
}) {
  const { t } = useTranslation();
  const c = useColors();
  const navigation = useNavigation();
  const [period, setPeriod] = useState<'day' | 'week'>('day');
  // Overall, or one of my subjects (people who focused on that subject in this room).
  const subjects = mySubjects(useFocusPrefs());
  const [picked, setPicked] = useState<Subject | 'all'>('all');
  const subject = picked !== 'all' && subjects.includes(picked) ? picked : undefined;
  const board = useBoard(roomId, periodKey(period, now), true, subject);
  const rows = (board ?? []).filter((r) => !hiddenPeople.includes(r.uid));
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <View style={s.section}>
      <AppText variant="heading">{t('rooms.boardTitle')}</AppText>
      <Segmented
        options={[
          { value: 'day' as const, label: t('rooms.today') },
          { value: 'week' as const, label: t('rooms.week') },
        ]}
        value={period}
        onChange={setPeriod}
      />
      <ChoiceChips
        options={[
          { id: 'all' as const, label: t('rooms.boardAll') },
          ...subjects.map((id) => ({ id, label: t(`focus.subjectNames.${id}`) })),
        ]}
        value={subject ?? 'all'}
        onChange={(v) => v && setPicked(v)}
        clearable={false}
      />
      {board && rows.length === 0 && (
        <AppText variant="muted">
          {subject ? t('rooms.boardSubjectEmpty', { subject: t(`focus.subjectNames.${subject}`) }) : t('rooms.boardEmpty')}
        </AppText>
      )}
      {rows.map((r: BoardRow, i) => (
        <View key={r.uid} style={[s.boardRow, r.uid === uid && { backgroundColor: c.accentSoft }]}>
          <AppText style={s.rank}>{medals[i] ?? `#${i + 1}`}</AppText>
          <AppText style={s.feedEmoji}>{avatarEmoji(r.avatar)}</AppText>
          <AppText style={[s.nick, s.flex]} numberOfLines={1}>{r.uid === uid ? `${r.nick} (${t('rooms.you')})` : r.nick}</AppText>
          <AppText style={s.boardMin} color={c.accentText}>{formatDuration(r.min * 60_000, t)}</AppText>
        </View>
      ))}
      {!optedIn && (
        <Card style={s.optIn}>
          <AppText style={s.nick}>{t('rooms.boardOptIn')}</AppText>
          <AppText variant="caption">{t('rooms.boardOptInSub')}</AppText>
          <Button variant="soft" icon="trophy-outline" label={t('rooms.boardOptIn')} onPress={() => navigation.navigate('RoomProfile')} />
        </Card>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  gone: { marginTop: 40, marginBottom: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  statusCard: { gap: 10 },
  statusTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bigClock: { fontFamily: fonts.bold, fontSize: 48, lineHeight: 58, includeFontPadding: false },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  inviteCard: { gap: 10, marginTop: 14 },
  code: { fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  section: { gap: 10, marginTop: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, borderRadius: radius.md, padding: 12, gap: 4, borderWidth: StyleSheet.hairlineWidth },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 24, lineHeight: 30 },
  liveDot: { position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: LIVE, borderWidth: 2 },
  nick: { fontSize: 15, fontWeight: '700' },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  feedEmoji: { fontSize: 22, lineHeight: 28 },
  five: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, minWidth: 54, alignItems: 'center' },
  fiveText: { fontSize: 15, fontWeight: '700' },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md },
  rank: { width: 34, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  boardMin: { fontSize: 15, fontWeight: '700' },
  optIn: { gap: 8, marginTop: 4 },
});
