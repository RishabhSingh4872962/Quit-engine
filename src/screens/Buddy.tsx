import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  answerAsk,
  BuddyAsk,
  BuddyStatus,
  createPairCode,
  endPairing,
  joinPair,
  setShare,
  useBuddy,
  useBuddyName,
  useShare,
  validBuddyName,
  writeBuddyName,
  publishBuddyStatus,
  syncBuddyPush,
} from '../lib/buddy';
import { hasPermission, requestPermission } from '../lib/notifications';
import { buddyPushAvailable } from '../lib/push';
import { formatDuration } from '../lib/format';
import { localDay } from '../lib/reels';
import { reportError } from '../lib/telemetry';
import { useNow } from '../lib/streak';
import { fonts, radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { ToggleRow } from '../components/ToggleRow';

/**
 * Accountability buddy: pair with one person by code, see each other's summary, say yes to "5 more".
 * Never shows or shares which habit (see src/lib/buddy.ts).
 */
export function BuddyScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const navigation = useNavigation();
  const buddy = useBuddy();
  const savedName = useBuddyName();
  const share = useShare();
  const [name, setName] = useState(savedName);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveName = () => {
    if (!validBuddyName(name)) {
      setError(t('buddy.nameHint'));
      return false;
    }
    writeBuddyName(name);
    void publishBuddyStatus();
    return true;
  };
  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      reportError(e, what);
      setError(t('rooms.error'));
    } finally {
      setBusy(false);
    }
  };
  const create = () => saveName() && void run('pair code', async () => void (await createPairCode()));
  const join = () =>
    saveName() &&
    void run('join pair', async () => {
      const r = await joinPair(code);
      if (r !== 'ok') setError(t(`buddy.join_${r}`));
    });
  const confirmEnd = () =>
    Alert.alert(t('buddy.endTitle'), t('buddy.endBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('buddy.endConfirm'), style: 'destructive', onPress: () => void run('end pairing', endPairing) },
    ]);

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <AppText variant="title" style={s.flex}>{t('buddy.title')}</AppText>
        <IconButton icon="close" label={t('setup.close')} onPress={navigation.goBack} filled />
      </View>
      <AppText variant="muted">{t('buddy.intro')}</AppText>

      {buddy.kind === 'none' && (
        <>
          <Card style={s.card}>
            <AppText variant="label">{t('buddy.nameTitle')}</AppText>
            <TextField
              value={name}
              onChangeText={(v) => {
                setName(v.slice(0, 20));
                setError(null);
              }}
              placeholder={t('buddy.namePlaceholder')}
              placeholderTextColor={c.textMuted}
              maxLength={20}
              style={s.input}
              accessibilityLabel={t('buddy.nameTitle')}
            />
            <AppText variant="caption">{t('buddy.nameSub')}</AppText>
          </Card>
          <Card style={s.card}>
            <AppText variant="heading">{t('buddy.startTitle')}</AppText>
            <AppText variant="caption">{t('buddy.startSub')}</AppText>
            <Button icon="key-outline" label={t('buddy.getCode')} onPress={create} disabled={busy} />
          </Card>
          <Card style={s.card}>
            <AppText variant="heading">{t('buddy.haveCode')}</AppText>
            <TextField
              value={code}
              onChangeText={(v) => {
                setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                setError(null);
              }}
              placeholder="ABC234"
              placeholderTextColor={c.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={[s.input, s.codeInput]}
              accessibilityLabel={t('buddy.haveCode')}
            />
            <Button variant="soft" label={t('buddy.pair')} onPress={join} disabled={busy || code.length !== 6} />
          </Card>
        </>
      )}

      {buddy.kind === 'loading' && <ActivityIndicator style={s.loading} color={c.accent} />}

      {buddy.kind === 'waiting' && (
        <Card style={s.card}>
          <AppText variant="label">{t('buddy.yourCode')}</AppText>
          <AppText style={s.code} color={c.accentText} selectable>{buddy.code}</AppText>
          <AppText variant="muted">{t('buddy.waitingSub')}</AppText>
          <Button
            icon="share-outline"
            label={t('buddy.shareCode')}
            onPress={() => void Share.share({ message: t('buddy.shareMessage', { code: buddy.code }) })}
          />
          <Button variant="ghost" label={t('common.cancel')} onPress={() => void run('cancel pairing', endPairing)} />
        </Card>
      )}

      {buddy.kind === 'paired' && (
        <>
          <BuddyCard status={buddy.status} />
          <PushNote />
          {buddy.asks.map((a) => (
            <AskCard key={a.id} ask={a} name={buddy.status?.name} />
          ))}
          <Card style={s.card}>
            <AppText variant="heading">{t('buddy.youTitle')}</AppText>
            <ToggleRow title={t('buddy.shareTitle')} sub={t('buddy.shareSub')} value={share} onChange={setShare} />
            <AppText variant="label" style={s.gap}>{t('buddy.nameTitle')}</AppText>
            <TextField
              value={name}
              onChangeText={(v) => {
                setName(v.slice(0, 20));
                setError(null);
              }}
              onEndEditing={() => name !== savedName && saveName()}
              maxLength={20}
              style={s.input}
              accessibilityLabel={t('buddy.nameTitle')}
            />
          </Card>
          <Button variant="ghost" label={t('buddy.end')} onPress={confirmEnd} />
        </>
      )}

      {error && <AppText variant="caption" color={c.danger} style={s.gap}>{error}</AppText>}
      <AppText variant="caption" center style={s.privacy}>{t('buddy.privacy')}</AppText>
    </Screen>
  );
}

/** My buddy's summary, as they share it. */
function BuddyCard({ status }: { status: BuddyStatus | null }) {
  const { t } = useTranslation();
  const c = useColors();
  const now = useNow();
  if (!status) {
    return (
      <Card style={s.card}>
        <AppText variant="heading">{t('buddy.pairedTitle')}</AppText>
        <AppText variant="muted">{t('buddy.noStatus')}</AppText>
      </Card>
    );
  }
  const today = status.day === localDay(now);
  const checkin = !today || status.kept === undefined ? t('buddy.checkinNone') : status.kept ? t('buddy.checkinKept') : t('buddy.checkinNot');
  return (
    <Card style={s.card}>
      <AppText variant="label">{t('buddy.pairedTitle')}</AppText>
      <AppText style={s.name} color={c.accentText}>{status.name}</AppText>
      <AppText>{t('buddy.streak', { count: status.streak })}</AppText>
      <AppText>{t('buddy.focus', { time: formatDuration((today ? status.focus : 0) * 60_000, t) })}</AppText>
      <AppText>{checkin}</AppText>
      <AppText variant="caption">
        {now - status.at < 60_000 ? t('buddy.updatedNow') : t('buddy.updated', { time: formatDuration(now - status.at, t) })}
      </AppText>
    </Card>
  );
}

/** Paired, but notifications are off here: my buddy's asks and answers can't reach this phone. */
function PushNote() {
  const { t } = useTranslation();
  const c = useColors();
  const [allowed, setAllowed] = useState(true);
  useEffect(() => {
    if (!buddyPushAvailable) return;
    const check = () => void hasPermission().then(setAllowed);
    check();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => sub.remove();
  }, []);
  if (!buddyPushAvailable || allowed) return null;
  const turnOn = async () => {
    if (!(await requestPermission())) return void Linking.openSettings();
    setAllowed(true);
    void syncBuddyPush();
  };
  return (
    <View style={[s.note, { backgroundColor: c.accentSoft }]}>
      <Ionicons name="notifications-off-outline" size={18} color={c.accentText} />
      <AppText variant="caption" color={c.accentText} style={s.flex}>{t('buddy.pushOff')}</AppText>
      <Pressable onPress={() => void turnOn()} hitSlop={8} accessibilityRole="button">
        <AppText style={s.link} color={c.accentText}>{t('settings.turnOn')}</AppText>
      </Pressable>
    </View>
  );
}

/** "<name> asks for 5 more today": yes adds them to their limit, without breaking their streak. */
export function AskCard({ ask, name }: { ask: BuddyAsk; name?: string }) {
  const { t } = useTranslation();
  return (
    <Card style={s.card}>
      <AppText variant="heading">{t('buddy.askTitle', { name: name ?? t('buddy.yourBuddy'), count: ask.n })}</AppText>
      <AppText variant="caption">{t('buddy.askSub')}</AppText>
      <View style={s.row}>
        <Button variant="soft" label={t('buddy.askNo')} onPress={() => answerAsk(ask.id, false)} style={s.flex} />
        <Button label={t('buddy.askYes')} onPress={() => answerAsk(ask.id, true)} style={s.flex} />
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  card: { gap: 10, marginTop: 14 },
  input: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 },
  codeInput: { letterSpacing: 4, fontFamily: fonts.bold, textAlign: 'center' },
  code: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 50, letterSpacing: 6, includeFontPadding: false },
  name: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, includeFontPadding: false },
  row: { flexDirection: 'row', gap: 10 },
  gap: { marginTop: 8 },
  loading: { marginTop: 32 },
  privacy: { marginTop: 18 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, marginTop: 14 },
  link: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
});
