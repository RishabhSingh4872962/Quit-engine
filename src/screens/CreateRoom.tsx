import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { StackActions, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { createRoom, enterRoom } from '../lib/rooms';
import { reportError } from '../lib/telemetry';
import { FocusTag, FOCUS_TAGS, hasLink, isBlockedText, ROOM_TIMERS } from '../rooms/data';
import { radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';
import { ToggleRow } from '../components/ToggleRow';

/** Create a custom room (public or invite-only). At most 3 per person. */
export function CreateRoomScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [tag, setTag] = useState<FocusTag>('other');
  const [timer, setTimer] = useState('0');
  const [quiet, setQuiet] = useState(false);
  const [invite, setInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const n = name.trim().replace(/\s+/g, ' ');
    if (n.length < 3) return;
    if (isBlockedText(n) || hasLink(n) || n.includes('<')) return setError(t('rooms.nameBlocked'));
    setBusy(true);
    setError(null);
    try {
      const { focus, brk } = ROOM_TIMERS[Number(timer)];
      const res = await createRoom({ name: n, tag, focus, brk, quiet, invite });
      if (res === 'limit') return Alert.alert(t('rooms.createTitle'), t('rooms.limit'));
      await enterRoom(res.id, invite);
      navigation.dispatch(StackActions.replace('Room', { id: res.id, hidden: invite }));
    } catch (e) {
      reportError(e, 'create room');
      setError(t('rooms.error'));
    } finally {
      setBusy(false);
    }
  };

  const timers = ROOM_TIMERS.map((r, i) => ({ value: String(i), label: r.brk ? `${r.focus}/${r.brk}` : t('rooms.timerOwn') }));

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <AppText variant="title" style={s.flex}>{t('rooms.createTitle')}</AppText>
        <IconButton icon="close" label={t('setup.close')} onPress={navigation.goBack} filled />
      </View>

      <Card style={s.card}>
        <AppText variant="label">{t('rooms.name')}</AppText>
        <TextInput
          value={name}
          onChangeText={(v) => {
            setName(v.slice(0, 40));
            setError(null);
          }}
          placeholder={t('rooms.namePlaceholder')}
          placeholderTextColor={c.textMuted}
          maxLength={40}
          style={[s.input, { color: c.text, backgroundColor: c.surfaceAlt }]}
          accessibilityLabel={t('rooms.name')}
        />
        {error && <AppText variant="caption" color="#D64545">{error}</AppText>}
      </Card>

      <Card style={s.card}>
        <AppText variant="label">{t('rooms.focusTag')}</AppText>
        <View style={s.tags}>
          {FOCUS_TAGS.map((id) => {
            const on = id === tag;
            return (
              <Pressable
                key={id}
                onPress={() => setTag(id)}
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
        <AppText variant="label">{t('rooms.timerLabel')}</AppText>
        <Segmented options={timers} value={timer} onChange={setTimer} />
      </Card>

      <Card style={s.card}>
        <ToggleRow title={t('rooms.silent')} sub={t('rooms.silentSub')} value={quiet} onChange={setQuiet} />
        <ToggleRow title={t('rooms.inviteOnly')} sub={t('rooms.inviteOnlySub')} value={invite} onChange={setInvite} />
      </Card>

      <Button icon="add" label={t('rooms.create')} onPress={() => void create()} disabled={busy || name.trim().length < 3} style={s.create} />
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  card: { gap: 10, marginTop: 14 },
  input: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  tagText: { fontWeight: '600' },
  create: { marginTop: 18 },
});
