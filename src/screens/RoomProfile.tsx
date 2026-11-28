import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { StaticScreenProps, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  deleteRoomsData,
  enterRoom,
  isNickFree,
  RoomProfile,
  roomsUid,
  saveRoomProfile,
  useRoomProfile,
  useRoomsUid,
} from '../lib/rooms';
import { endPairing } from '../lib/buddy';
import { reportError } from '../lib/telemetry';
import { AVATARS, avatarIds, FocusTag, FOCUS_TAGS, isBlockedText, NICK_RE } from '../rooms/data';
import { radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { ToggleRow } from '../components/ToggleRow';

type Props = StaticScreenProps<{ join?: { id: string; hidden: boolean } } | undefined>;

// Play's user-generated-content policy: people agree to the rules before choosing a nickname.
const RULES_URL = 'https://quit-engine-app.web.app/rules';

/** Room profile: nickname, avatar, focus tag and leaderboard opt-in. Opened before joining a room. */
export function RoomProfileScreen({ route }: Props) {
  const uid = useRoomsUid();
  const profile = useRoomProfile(uid);
  // Wait for the saved profile, so the form starts with it (keyed: a new profile remounts the form).
  if (uid && profile === undefined) return <Screen>{null}</Screen>;
  return <ProfileForm key={profile?.nick ?? 'new'} initial={profile ?? null} join={route.params?.join} />;
}

function ProfileForm({ initial, join }: { initial: RoomProfile | null; join?: { id: string; hidden: boolean } }) {
  const { t } = useTranslation();
  const c = useColors();
  const navigation = useNavigation();
  const [nick, setNick] = useState(initial?.nick ?? '');
  const [avatar, setAvatar] = useState(initial?.avatar ?? 'a01');
  const [tag, setTag] = useState<FocusTag | undefined>(initial?.tag);
  const [board, setBoard] = useState(initial?.board ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = nick.trim();
    if (!NICK_RE.test(n)) return setError(t('rooms.nickHint'));
    if (isBlockedText(n)) return setError(t('rooms.nickBlocked'));
    setBusy(true);
    setError(null);
    try {
      const uid = await roomsUid();
      if (!(await isNickFree(n, uid))) return setError(t('rooms.nickTaken'));
      await saveRoomProfile({ nick: n, avatar, tag, board }, initial?.nick);
      if (join) await enterRoom(join.id, join.hidden);
      navigation.goBack();
    } catch (e) {
      reportError(e, 'save room profile');
      setError(t('rooms.error'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(t('rooms.deleteTitle'), t('rooms.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('rooms.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await endPairing(); // the account goes, so the buddy pairing ends too
            await deleteRoomsData(true);
            navigation.goBack();
          } catch (e) {
            reportError(e, 'delete room profile');
            Alert.alert(t('rooms.title'), t('rooms.error'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <AppText variant="title" style={s.flex}>{t('rooms.profileTitle')}</AppText>
        <IconButton icon="close" label={t('setup.close')} onPress={navigation.goBack} filled />
      </View>
      <AppText variant="muted">{t('rooms.profileSub')}</AppText>

      <Card style={s.card}>
        <AppText variant="label">{t('rooms.nick')}</AppText>
        <TextInput
          value={nick}
          onChangeText={(v) => {
            setNick(v.replace(/[^A-Za-z0-9_]/g, '').slice(0, 20));
            setError(null);
          }}
          placeholder="study_owl"
          placeholderTextColor={c.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          style={[s.input, { color: c.text, backgroundColor: c.surfaceAlt }]}
          accessibilityLabel={t('rooms.nick')}
        />
        <AppText variant="caption" color={error ? '#D64545' : undefined}>{error ?? t('rooms.nickHint')}</AppText>
      </Card>

      <Card style={s.card}>
        <AppText variant="label">{t('rooms.avatar')}</AppText>
        <View style={s.avatars}>
          {AVATARS.map((emoji, i) => {
            const id = avatarIds[i];
            const on = id === avatar;
            return (
              <Pressable
                key={id}
                onPress={() => setAvatar(id)}
                style={[s.avatar, { backgroundColor: on ? c.accent : c.surfaceAlt }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={emoji}
              >
                <AppText style={s.avatarEmoji}>{emoji}</AppText>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={s.card}>
        <AppText variant="label">{t('rooms.focusTag')}</AppText>
        <View style={s.tags}>
          {FOCUS_TAGS.map((id) => {
            const on = id === tag;
            return (
              <Pressable
                key={id}
                onPress={() => setTag(on ? undefined : id)}
                style={[s.tag, { backgroundColor: on ? c.accent : c.surfaceAlt }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
              >
                <AppText style={s.tagText} color={on ? c.onAccent : c.text}>{t(`rooms.tags.${id}`)}</AppText>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={s.card}>
        <ToggleRow title={t('rooms.boardOptIn')} sub={t('rooms.boardOptInSub')} value={board} onChange={setBoard} />
      </Card>

      <Button label={t('rooms.save')} onPress={() => void save()} disabled={busy || nick.trim().length < 3} style={s.save} />
      <AppText variant="caption" center style={s.agree}>{t('rooms.agree')}</AppText>
      <Pressable onPress={() => void Linking.openURL(RULES_URL)} hitSlop={8} accessibilityRole="link">
        <AppText variant="caption" center style={s.rules} color={c.accentText}>{t('rooms.rulesLink')}</AppText>
      </Pressable>
      {initial && <Button variant="ghost" label={t('rooms.deleteProfile')} onPress={confirmDelete} disabled={busy} />}
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  card: { gap: 10, marginTop: 14 },
  input: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '600' },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 24, lineHeight: 30 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  tagText: { fontWeight: '600' },
  save: { marginTop: 18 },
  agree: { marginTop: 10 },
  rules: { textDecorationLine: 'underline', marginBottom: 8, paddingVertical: 4 },
});
