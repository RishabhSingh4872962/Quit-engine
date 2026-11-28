import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HABIT_LIST } from '../habits';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import { activeBlockUntil, APP_LIMIT_OPTIONS, BlockPrefs, strictLocked, TimeWindow, useBlock } from '../lib/blocking';
import { useNow } from '../lib/streak';
import { radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { TextField } from '../components/TextField';
import { Group, Row, RowIcon, RowLetter, rowPad } from '../components/Group';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';
import { ToggleRow } from '../components/ToggleRow';

type WindowKey = 'bedtime' | 'study';
type Picking = { kind: 'time'; key: WindowKey; field: 'start' | 'end' } | { kind: 'date' } | null;

/**
 * Premium reel blocking: per app, reel-free hours, per-app daily limits, exam mode, strict mode.
 * The native service applies the rules; this screen only edits them.
 */
export function ReelBlockingScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const prefs = useBlock();
  const now = useNow(30_000);
  const [picking, setPicking] = useState<Picking>(null);
  const [channel, setChannel] = useState('');
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const apps = HABIT_LIST.find((h) => h.reelApps)?.reelApps ?? [];

  const locked = strictLocked(prefs, now);
  const until = activeBlockUntil(prefs, now);
  const timeLabel = (min: number) =>
    new Date(2000, 0, 1, Math.floor(min / 60), min % 60).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  const dateLabel = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const setWindow = (key: WindowKey, patch: Partial<TimeWindow>) => actions.setReelBlock({ [key]: { ...prefs[key], ...patch } });

  // YouTube study mode reads channel names, so it needs its own explicit consent (Play policy).
  const setStudyMode = (mode: BlockPrefs['studyMode']) => {
    if (mode === 'off' || prefs.studyConsentAt) return actions.setReelBlock({ studyMode: mode });
    Alert.alert(t('blocking.studyConsentTitle'), t('blocking.studyConsentBody'), [
      { text: t('reels.notNow'), style: 'cancel' },
      { text: t('blocking.studyConsentAgree'), onPress: () => actions.setReelBlock({ studyMode: mode, studyConsentAt: Date.now() }) },
    ]);
  };
  const addChannel = () => {
    const name = channel.trim();
    if (name && !prefs.studyChannels.some((c) => c.toLowerCase() === name.toLowerCase())) {
      actions.setReelBlock({ studyChannels: [...prefs.studyChannels, name] });
    }
    setChannel('');
  };

  const windowRow = (key: WindowKey) => {
    const w = prefs[key];
    return (
      <View key={key}>
        <ToggleRow
          leading={<RowIcon icon={key === 'bedtime' ? 'moon-outline' : 'book-outline'} />}
          title={t(`blocking.${key}`)}
          sub={`${timeLabel(w.start)} – ${timeLabel(w.end)}`}
          value={w.on}
          onChange={(on) => setWindow(key, { on })}
          style={rowPad}
        />
        {w.on && (
          <View style={s.times}>
            {(['start', 'end'] as const).map((field) => (
              <Pressable
                key={field}
                onPress={() => setPicking({ kind: 'time', key, field })}
                style={[s.pill, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}
                accessibilityRole="button"
              >
                <AppText variant="caption">{t(field === 'start' ? 'blocking.from' : 'blocking.to')}</AppText>
                <AppText style={s.pillValue} color={c.accentText}>{timeLabel(w[field])}</AppText>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <AppText variant="title">{t('blocking.title')}</AppText>
        <IconButton icon="close" label={t('setup.close')} onPress={navigation.goBack} filled />
      </View>

      {locked && until !== null && (
        <View style={[s.banner, { backgroundColor: c.accentSoft, borderColor: c.glow }]}>
          <Ionicons name="lock-closed" size={18} color={c.accentText} />
          <AppText style={s.flex} color={c.accentText}>
            {t('blocking.strictActive', { time: `${dateLabel(until)} ${timeLabel(new Date(until).getHours() * 60 + new Date(until).getMinutes())}` })}
          </AppText>
        </View>
      )}

      {/* While Strict mode holds, nothing here can be loosened. */}
      <View pointerEvents={locked ? 'none' : 'auto'} style={locked && s.locked}>
        <Group label={t('blocking.appsTitle')} note={t('blocking.appsSub')}>
          {apps.map((a) => (
            <ToggleRow
              key={a.id}
              leading={<RowLetter text={a.name} />}
              title={a.name}
              sub={prefs.apps.includes(a.id) ? t('blocking.blockedAlways') : t('blocking.allowed')}
              value={prefs.apps.includes(a.id)}
              onChange={(on) =>
                actions.setReelBlock({ apps: on ? [...prefs.apps, a.id] : prefs.apps.filter((p) => p !== a.id) })
              }
              style={rowPad}
            />
          ))}
        </Group>

        <Group label={t('blocking.windowsTitle')}>
          {windowRow('bedtime')}
          {windowRow('study')}
        </Group>

        <Group label={t('blocking.studyTitle')} note={t('blocking.studySub')}>
          <View style={[rowPad, s.block]}>
            <Segmented
              options={[
                { value: 'off' as const, label: t('reels.limitOff') },
                { value: 'study' as const, label: t('blocking.studyDuring') },
                { value: 'always' as const, label: t('blocking.studyAlways') },
              ]}
              value={prefs.studyMode}
              onChange={setStudyMode}
            />
            {prefs.studyMode !== 'off' && (
              <>
                <View style={s.addRow}>
                  <TextField
                    value={channel}
                    onChangeText={setChannel}
                    onSubmitEditing={addChannel}
                    placeholder={t('blocking.studyPlaceholder')}
                    placeholderTextColor={c.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    style={s.input}
                  />
                  <Pressable onPress={addChannel} style={[s.addBtn, { backgroundColor: c.accent }]} accessibilityRole="button" accessibilityLabel={t('blocking.studyAdd')}>
                    <Ionicons name="add" size={22} color={c.onAccent} />
                  </Pressable>
                </View>
                {prefs.studyChannels.length > 0 && (
                  <View style={s.chips}>
                    {prefs.studyChannels.map((name) => (
                      <Pressable
                        key={name}
                        onPress={() => actions.setReelBlock({ studyChannels: prefs.studyChannels.filter((n) => n !== name) })}
                        style={[s.chip, { backgroundColor: c.accentSoft }]}
                        accessibilityRole="button"
                        accessibilityLabel={t('blocking.studyRemove', { name })}
                      >
                        <AppText style={s.chipText} color={c.accentText}>{name}</AppText>
                        <Ionicons name="close" size={14} color={c.accentText} />
                      </Pressable>
                    ))}
                  </View>
                )}
                {prefs.studyChannels.length === 0 && <AppText variant="caption">{t('blocking.studyNone')}</AppText>}
                {prefs.studyMode === 'study' && !prefs.study.on && (
                  <AppText variant="caption">{t('blocking.studyNeedWindow')}</AppText>
                )}
              </>
            )}
          </View>
        </Group>

        <Group label={t('blocking.limitsTitle')} note={t('blocking.limitsSub')}>
          {apps.map((a) => (
            <Row key={a.id} leading={<RowLetter text={a.name} />} title={a.name}>
              <Segmented
                options={APP_LIMIT_OPTIONS.map((n) => ({ value: String(n), label: n ? String(n) : t('reels.limitOff') }))}
                value={String(prefs.appLimits[a.id] ?? 0)}
                onChange={(v) => actions.setReelBlock({ appLimits: { ...prefs.appLimits, [a.id]: Number(v) } })}
              />
            </Row>
          ))}
        </Group>

        <Group>
          <ToggleRow
            leading={<RowIcon icon="school-outline" />}
            title={t('blocking.examTitle')}
            sub={prefs.examUntil > now ? t('blocking.examUntil', { date: dateLabel(prefs.examUntil) }) : t('blocking.examSub')}
            value={prefs.examUntil > now}
            onChange={(on) => (on ? setPicking({ kind: 'date' }) : actions.setReelBlock({ examUntil: 0 }))}
            style={rowPad}
          />
          <ToggleRow
            leading={<RowIcon icon="lock-closed-outline" />}
            title={t('blocking.strictTitle')}
            sub={t('blocking.strictSub')}
            value={prefs.strict}
            onChange={(strict) => actions.setReelBlock({ strict })}
            style={rowPad}
          />
        </Group>
      </View>

      {picking?.kind === 'time' && (
        <DateTimePicker
          value={new Date(2000, 0, 1, Math.floor(prefs[picking.key][picking.field] / 60), prefs[picking.key][picking.field] % 60)}
          mode="time"
          onValueChange={(_, date) => {
            setPicking(null);
            setWindow(picking.key, { [picking.field]: date.getHours() * 60 + date.getMinutes() });
          }}
          onDismiss={() => setPicking(null)}
        />
      )}
      {picking?.kind === 'date' && (
        <DateTimePicker
          value={new Date(now + 7 * 86_400_000)}
          mode="date"
          minimumDate={new Date(now)}
          onValueChange={(_, date) => {
            setPicking(null);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999); // through the end of that day
            actions.setReelBlock({ examUntil: end.getTime() });
          }}
          onDismiss={() => setPicking(null)}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1, marginBottom: 20 },
  locked: { opacity: 0.5 },
  block: { gap: 12 },
  times: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  pill: { flex: 1, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, gap: 2 },
  pillValue: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  addBtn: { width: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  chipText: { fontWeight: '600' },
});
