import React, { useCallback, useState } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HABIT_LIST, HABITS } from '../habits';
import { HabitId } from '../habits/types';
import { LANGS, setLanguage, useLang } from '../i18n';
import { actions } from '../lib/actions';
import {
  backupNow,
  deleteBackupAndAccount,
  readCloudBackup,
  restoreBackup,
  signInWithGoogle,
  signOut,
  useBackupUser,
  useLastBackupAt,
} from '../lib/backup';
import { useBuddy } from '../lib/buddy';
import {
  LIMIT_OPTIONS,
  openReelSettings,
  reelCounterAvailable,
  reelLimitState,
  useReelBubble,
  useReelCounter,
  useReelLimit,
  useWebReels,
} from '../lib/reels';
import { useBlock } from '../lib/blocking';
import { BREATH_OPTIONS, GRACE_OPTIONS, installedGateApps, useGate } from '../lib/gate';
import { streakDays, useNow } from '../lib/streak';
import { manageSubscription, premiumAvailable, premiumTestMode, usePremium } from '../lib/premium';
import { remote } from '../lib/remoteConfig';
import { reportError } from '../lib/telemetry';
import { hasPermission, requestPermission, syncNotifications } from '../lib/notifications';
import { useCheckin, useHabitState, useMilestoneAlerts, useTracked } from '../lib/storage';
import { makePalette, radius, useColors } from '../theme';
import { pinStreakWidget } from '../widget';
import { AppText } from '../components/AppText';
import { Group, Row, RowIcon, RowLetter, rowPad } from '../components/Group';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';
import { ToggleRow } from '../components/ToggleRow';

// Hosted on Firebase Hosting (hosting/privacy.html). Also linked from the Play Store listing.
const PRIVACY_URL = 'https://quit-engine-app.web.app/privacy';

/** Settings as grouped lists: habits, Premium, reels, pause before opening, notifications, general, backup. */
export function SettingsScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const user = useBackupUser();

  return (
    <Screen scroll>
      <AppText variant="title" style={s.title}>{t('settings.title')}</AppText>

      <HabitSettings />
      {premiumAvailable && <PremiumSettings />}
      <ReelSettings />
      <GateSettings />
      <NotificationSettings />
      <GeneralSettings />
      {remote.cloudBackupEnabled() && <BackupSettings />}

      <View style={s.footer}>
        <View style={s.privacy}>
          <Ionicons name="lock-closed" size={14} color={c.textMuted} />
          <AppText variant="caption">{user ? t('backup.privacyOn') : t('settings.privacy')}</AppText>
        </View>
        <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} hitSlop={8} accessibilityRole="link">
          <AppText variant="caption" style={s.policy}>{t('settings.privacyPolicy')}</AppText>
        </Pressable>
        <AppText variant="caption">{t('settings.version', { version: Constants.expoConfig?.version ?? '' })}</AppText>
      </View>
    </Screen>
  );
}

function HabitSettings() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const tracked = useTracked();
  return (
    <Group label={t('settings.habits')}>
      {tracked.map((id) => <HabitRow key={id} id={id} removable={tracked.length > 1} />)}
      {tracked.length < HABIT_LIST.length && (
        <Row icon="add" title={t('settings.addHabit')} onPress={() => navigation.navigate('AddHabit')} />
      )}
    </Group>
  );
}

/** One tracked habit in its own colour, with its current streak and a way to stop tracking it. */
function HabitRow({ id, removable }: { id: HabitId; removable: boolean }) {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const habit = HABITS[id];
  const state = useHabitState(id);
  const now = useNow();
  const h = makePalette(habit.accent, c.scheme);
  const name = habit.name[lang];
  const days = streakDays(state.streakStart, now);

  const confirmRemove = () =>
    Alert.alert(t('settings.removeTitle', { name }), t('settings.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.remove'), style: 'destructive', onPress: () => actions.removeHabit(id) },
    ]);

  return (
    <Row
      icon={habit.icon}
      iconColor={h.accentText}
      title={name}
      sub={state.streakStart !== null ? `${days} ${t('common.days', { count: days })}` : undefined}
      right={removable ? (
        <Pressable
          onPress={confirmRemove}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('settings.removeTitle', { name })}
          style={s.remove}
        >
          <Ionicons name="close" size={18} color={c.textMuted} />
        </Pressable>
      ) : null}
    />
  );
}

function PremiumSettings() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const premium = usePremium();
  return (
    <Group>
      <Row
        icon="sparkles"
        title={t('premium.title')}
        sub={premium ? t('premium.active') : t('premium.pitch')}
        note={premium && premiumTestMode ? t('premium.testReset') : undefined}
        hint={premium ? t('premium.manage') : t('premium.see')}
        onPress={premium ? () => void manageSubscription() : () => navigation.navigate('Paywall')}
      />
    </Group>
  );
}

/** Reel counting, the daily limit and its pauses, and the way into blocking (Premium). */
function ReelSettings() {
  const { t } = useTranslation();
  const c = useColors();
  const navigation = useNavigation();
  const tracked = useTracked();
  const premium = usePremium();
  const { enabled } = useReelCounter(1);
  const limit = useReelLimit();
  const bubble = useReelBubble();
  const web = useWebReels();
  const block = useBlock();
  const now = useNow();
  const [pausesOff, setPausesOff] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setPausesOff(reelLimitState()?.pausesOffToday ?? false); // may have changed on the Pause screen
    }, []),
  );
  if (!reelCounterAvailable || !tracked.some((id) => HABITS[id].reelApps)) return null;

  const options = LIMIT_OPTIONS.map((n) => ({ value: String(n), label: n ? String(n) : t('reels.limitOff') }));
  const blockingSetUp = block.apps.length > 0 || block.bedtime.on || block.study.on || block.examUntil > now
    || Object.values(block.appLimits).some((n) => n > 0);
  const setWeb = (on: boolean) =>
    on
      ? Alert.alert(t('reels.webConsentTitle'), t('reels.webConsentBody'), [
          { text: t('reels.notNow'), style: 'cancel' },
          { text: t('reels.webConsentAgree'), onPress: () => actions.setWebReels(true) },
        ])
      : actions.setWebReels(false);

  return (
    <Group label={t('settings.reels')}>
      {enabled ? (
        <Row icon="film" title={t('reels.settingsTitle')} sub={t('reels.settingsOn')} />
      ) : (
        <Row icon="film" title={t('reels.turnOn')} sub={t('reels.settingsOff')} onPress={() => navigation.navigate('ReelCounterSetup')} />
      )}
      {enabled && (
        <Row icon="speedometer-outline" title={t('reels.limitTitle')} note={t('reels.limitSub')}>
          <Segmented
            options={options}
            value={String(limit)}
            onChange={(v) => {
              actions.setReelLimit(Number(v));
              setPausesOff(false);
            }}
          />
          {limit > 0 && pausesOff && (
            <View style={[s.pausesOff, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
              <AppText variant="caption" style={s.flex}>{t('reels.pausesOff')}</AppText>
              <Pressable
                onPress={() => {
                  actions.resumeReelPauses();
                  setPausesOff(false);
                }}
                hitSlop={8}
                accessibilityRole="button"
              >
                <AppText style={s.link} color={c.accentText}>{t('reels.pausesOn')}</AppText>
              </Pressable>
            </View>
          )}
        </Row>
      )}
      {enabled && (
        <ToggleRow
          leading={<RowIcon icon="pulse-outline" />}
          title={t('reels.bubbleTitle')}
          sub={t('reels.bubbleSub')}
          value={bubble}
          onChange={(on) => actions.setReelBubble(on)}
          style={rowPad}
        />
      )}
      {enabled && (
        <ToggleRow
          leading={<RowIcon icon="globe-outline" />}
          title={t('reels.webTitle')}
          sub={t('reels.webSub')}
          value={web}
          onChange={setWeb}
          style={rowPad}
        />
      )}
      {premiumAvailable && (
        <Row
          icon="hand-left-outline"
          title={t('blocking.title')}
          sub={!premium ? t('blocking.pitch') : blockingSetUp ? t('blocking.summaryOn') : t('blocking.summaryOff')}
          badge={premium ? undefined : t('premium.title')}
          hint={premium ? t('blocking.setUp') : t('premium.unlock')}
          onPress={() =>
            !premium
              ? navigation.navigate('Paywall')
              : enabled
                ? navigation.navigate('ReelBlocking')
                : navigation.navigate('ReelCounterSetup')
          }
        />
      )}
      {enabled && <Row icon="checkmark-done-outline" title={t('reelCheck.title')} onPress={() => navigation.navigate('ReelCheck')} />}
      {enabled && <Row icon="settings-outline" title={t('reels.settingsManage')} onPress={openReelSettings} />}
    </Group>
  );
}

/**
 * "Pause before opening" (like one sec): a breathing pause when chosen apps open. Uses the reel
 * counter's accessibility service, so it needs that switched on first.
 */
function GateSettings() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const tracked = useTracked();
  const gate = useGate();
  const { enabled, stats } = useReelCounter(1);
  const [apps] = useState(installedGateApps); // installed apps rarely change while Settings is open
  if (!reelCounterAvailable || !tracked.some((id) => HABITS[id].gateApps)) return null;
  const today = stats[stats.length - 1];
  const opensOf = (id: string) => today?.apps[id]?.opens ?? 0;
  const opens = gate.apps.reduce((n, id) => n + opensOf(id), 0);
  const skips = gate.apps.reduce((n, id) => n + (today?.apps[id]?.skips ?? 0), 0);
  const toggle = (id: string, on: boolean) =>
    actions.setGate({ apps: on ? [...gate.apps, id] : gate.apps.filter((a) => a !== id) });

  if (!enabled) {
    return (
      <Group label={t('gate.settingsTitle')} note={t('gate.settingsSub')}>
        <Row icon="pause-circle-outline" title={t('reels.turnOn')} sub={t('gate.needCounter')} onPress={() => navigation.navigate('ReelCounterSetup')} />
      </Group>
    );
  }
  return (
    <Group label={t('gate.settingsTitle')} note={t('gate.settingsSub')}>
      {apps.length === 0 && <Row icon="apps-outline" title={t('gate.noApps')} />}
      {apps.map((a) => (
        <ToggleRow
          key={a.id}
          leading={<RowLetter text={a.name} />}
          title={a.name}
          sub={t('gate.appToday', { count: opensOf(a.id) })}
          value={gate.apps.includes(a.id)}
          onChange={(on) => toggle(a.id, on)}
          style={rowPad}
        />
      ))}
      {gate.apps.length > 0 && (
        <Row icon="leaf-outline" title={t('gate.breath')}>
          <Segmented
            options={BREATH_OPTIONS.map((n) => ({ value: String(n), label: t('gate.seconds', { count: n }) }))}
            value={String(gate.breath)}
            onChange={(v) => actions.setGate({ breath: Number(v) })}
          />
        </Row>
      )}
      {gate.apps.length > 0 && (
        <Row icon="time-outline" title={t('gate.grace')}>
          <Segmented
            options={GRACE_OPTIONS.map((n) => ({ value: String(n), label: t('gate.minutes', { count: n }) }))}
            value={String(gate.grace)}
            onChange={(v) => actions.setGate({ grace: Number(v) })}
          />
        </Row>
      )}
      {gate.apps.length > 0 && opens > 0 && <Row icon="stats-chart-outline" title={t('gate.todayLine', { opens, skips })} />}
    </Group>
  );
}

function NotificationSettings() {
  const { t } = useTranslation();
  const lang = useLang();
  const checkin = useCheckin();
  const milestoneAlerts = useMilestoneAlerts();
  const [allowed, setAllowed] = useState(true);
  const [picking, setPicking] = useState(false);

  // Re-check on focus and when coming back from system settings.
  useFocusEffect(
    useCallback(() => {
      const check = () => void hasPermission().then((ok) => {
        setAllowed(ok);
        if (ok) void syncNotifications();
      });
      check();
      const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
      return () => sub.remove();
    }, []),
  );

  const turnOn = async () => {
    // If Android won't show the prompt again, the only way is the system settings page.
    if (await requestPermission()) setAllowed(true);
    else await Linking.openSettings();
  };

  const time = new Date();
  time.setHours(checkin.hour, checkin.minute, 0, 0);
  const timeLabel = new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(time);

  return (
    <>
      <Group label={t('settings.notifications')}>
        {!allowed && (
          <Row
            icon="notifications-off-outline"
            title={t('settings.notificationsOff')}
            value={t('settings.turnOn')}
            onPress={() => void turnOn()}
          />
        )}
        <ToggleRow
          leading={<RowIcon icon="trophy-outline" />}
          title={t('settings.milestoneAlerts')}
          sub={t('settings.milestoneAlertsSub')}
          value={milestoneAlerts}
          onChange={(on) => void actions.setMilestoneAlerts(on)}
          style={rowPad}
        />
        <ToggleRow
          leading={<RowIcon icon="notifications-outline" />}
          title={t('settings.checkin')}
          sub={t('settings.checkinSub')}
          value={checkin.enabled}
          onChange={(on) => void actions.setCheckin({ enabled: on })}
          style={rowPad}
        />
        {checkin.enabled && (
          <Row icon="time-outline" title={t('settings.checkinTime')} value={timeLabel} onPress={() => setPicking(true)} />
        )}
      </Group>
      {picking && (
        <DateTimePicker
          value={time}
          mode="time"
          onValueChange={(_, date) => {
            setPicking(false);
            void actions.setCheckin({ hour: date.getHours(), minute: date.getMinutes() });
          }}
          onDismiss={() => setPicking(false)}
        />
      )}
    </>
  );
}

/** Language, the accountability buddy and the home-screen widget. */
function GeneralSettings() {
  const { t } = useTranslation();
  const lang = useLang();
  const navigation = useNavigation();
  const buddy = useBuddy();
  const buddyName = buddy.kind === 'paired' ? buddy.status?.name : undefined;
  return (
    <Group label={t('settings.general')}>
      <Row icon="language" title={t('settings.language')}>
        <Segmented options={LANGS.map((l) => ({ value: l.id, label: l.label }))} value={lang} onChange={setLanguage} />
      </Row>
      <Row
        icon="people-outline"
        title={t('buddy.title')}
        sub={buddyName ? t('buddy.rowWith', { name: buddyName }) : t('buddy.rowSub')}
        onPress={() => navigation.navigate('Buddy')}
      />
      {Platform.OS === 'android' && (
        <Row
          icon="grid-outline"
          title={t('widget.title')}
          sub={t('widget.body')}
          hint={t('widget.add')}
          onPress={() => void pinStreakWidget().then((ok) => ok || Alert.alert(t('widget.title'), t('widget.manual')))}
        />
      )}
    </Group>
  );
}

function BackupSettings() {
  const { t } = useTranslation();
  const lang = useLang();
  const user = useBackupUser();
  const lastAt = useLastBackupAt();
  const [busy, setBusy] = useState(false);

  const fmt = new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  /** Runs one backup action at a time; on failure, reports it and shows a friendly message. */
  const run = async (what: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      reportError(e, what);
      Alert.alert(t('backup.errorTitle'), t('backup.errorBody'));
    } finally {
      setBusy(false);
    }
  };

  const enable = () =>
    run('backup sign-in', async () => {
      if (!(await signInWithGoogle())) return; // cancelled
      const cloud = await readCloudBackup();
      if (!cloud) return backupNow();
      // A backup already exists (e.g. a new phone): let the user choose which side wins.
      Alert.alert(t('backup.foundTitle'), t('backup.foundBody', { date: fmt.format(cloud.updatedAt) }), [
        { text: t('backup.keepPhone'), onPress: () => void run('backup overwrite', backupNow) },
        { text: t('backup.restore'), onPress: () => restoreBackup(cloud) },
      ]);
    });

  const confirmDelete = () =>
    Alert.alert(t('backup.deleteTitle'), t('backup.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('backup.deleteConfirm'), style: 'destructive', onPress: () => void run('delete account', deleteBackupAndAccount) },
    ]);

  if (!user) {
    return (
      <Group label={t('backup.title')}>
        <Row icon="logo-google" title={t('backup.signIn')} sub={t('backup.intro')} onPress={busy ? undefined : () => void enable()} />
      </Group>
    );
  }
  return (
    <Group label={t('backup.title')}>
      <Row
        icon="person-circle-outline"
        title={t('backup.signedInAs', { email: user.email ?? '' })}
        sub={lastAt ? t('backup.lastBackup', { time: fmt.format(lastAt) }) : t('backup.never')}
      />
      <Row icon="cloud-upload-outline" title={t('backup.backupNow')} onPress={busy ? undefined : () => void run('backup now', backupNow)} />
      <Row icon="log-out-outline" title={t('backup.signOut')} onPress={busy ? undefined : () => void run('sign out', signOut)} />
      <Row icon="trash-outline" title={t('backup.delete')} danger onPress={busy ? undefined : confirmDelete} />
    </Group>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  title: { marginBottom: 20 },
  remove: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pausesOff: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 12, borderRadius: radius.md, borderWidth: 1 },
  link: { fontSize: 14, fontWeight: '700' },
  footer: { alignItems: 'center', gap: 6, marginTop: 4 },
  policy: { textDecorationLine: 'underline' },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
