import React, { useCallback, useState } from 'react';
import { Alert, AppState, Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import Constants from 'expo-constants';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HABIT_LIST, HABITS } from '../habits';
import { LANGS, setLanguage, useLang } from '../i18n';
import { actions } from '../lib/actions';
import {
  backupNow,
  deleteBackupAndAccount,
  readCloudBackup,
  restoreBackup,
  signInWithGoogle,
  signOut,
  useAuthUser,
  useLastBackupAt,
} from '../lib/backup';
import { remote } from '../lib/remoteConfig';
import { reportError } from '../lib/telemetry';
import { hasPermission, requestPermission, syncNotifications } from '../lib/notifications';
import { ThemePref, useCheckin, useMilestoneAlerts, useThemePref, useTracked } from '../lib/storage';
import { makePalette, radius, setThemePref, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';

export function SettingsScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const theme = useThemePref();
  const c = useColors();
  const user = useAuthUser();

  const themes: { value: ThemePref; label: string }[] = [
    { value: 'system', label: t('settings.system') },
    { value: 'light', label: t('settings.light') },
    { value: 'dark', label: t('settings.dark') },
  ];

  return (
    <Screen scroll>
      <AppText variant="title" style={s.title}>{t('settings.title')}</AppText>

      <HabitSettings />

      <Section icon="language" title={t('settings.language')}>
        <Segmented options={LANGS.map((l) => ({ value: l.id, label: l.label }))} value={lang} onChange={setLanguage} />
      </Section>

      <Section icon="contrast" title={t('settings.appearance')}>
        <Segmented options={themes} value={theme} onChange={setThemePref} />
      </Section>

      <NotificationSettings />

      {remote.cloudBackupEnabled() && <BackupSettings />}

      <View style={s.footer}>
        <View style={s.privacy}>
          <Ionicons name="lock-closed" size={14} color={c.textMuted} />
          <AppText variant="caption">{user ? t('backup.privacyOn') : t('settings.privacy')}</AppText>
        </View>
        <AppText variant="caption">{t('settings.version', { version: Constants.expoConfig?.version ?? '' })}</AppText>
      </View>
    </Screen>
  );
}

function HabitSettings() {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const tracked = useTracked();

  const confirmRemove = (name: string, remove: () => void) =>
    Alert.alert(t('settings.removeTitle', { name }), t('settings.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.remove'), style: 'destructive', onPress: remove },
    ]);

  return (
    <Section icon="apps" title={t('settings.habits')}>
      {tracked.map((id) => {
        const habit = HABITS[id];
        const h = makePalette(habit.accent, c.scheme);
        return (
          <View key={id} style={s.row}>
            <View style={[s.habitIcon, { backgroundColor: h.accentSoft }]}>
              <Ionicons name={habit.icon} size={18} color={h.accent} />
            </View>
            <AppText style={[s.rowTitle, s.flex]}>{habit.name[lang]}</AppText>
            {tracked.length > 1 && (
              <Pressable
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('settings.removeTitle', { name: habit.name[lang] })}
                onPress={() => confirmRemove(habit.name[lang], () => actions.removeHabit(id))}
              >
                <Ionicons name="close-circle-outline" size={22} color={c.textMuted} />
              </Pressable>
            )}
          </View>
        );
      })}
      {tracked.length < HABIT_LIST.length && (
        <Button variant="soft" icon="add" label={t('settings.addHabit')} onPress={() => navigation.navigate('AddHabit')} />
      )}
    </Section>
  );
}

function BackupSettings() {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const user = useAuthUser();
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

  return (
    <Section icon="cloud-upload-outline" title={t('backup.title')}>
      {!user ? (
        <>
          <AppText variant="caption">{t('backup.intro')}</AppText>
          <Button variant="soft" icon="logo-google" label={t('backup.signIn')} onPress={() => void enable()} disabled={busy} />
        </>
      ) : (
        <>
          <View>
            <AppText style={s.rowTitle}>{t('backup.signedInAs', { email: user.email ?? '' })}</AppText>
            <AppText variant="caption">
              {lastAt ? t('backup.lastBackup', { time: fmt.format(lastAt) }) : t('backup.never')}
            </AppText>
          </View>
          <Button variant="soft" icon="cloud-upload-outline" label={t('backup.backupNow')} onPress={() => void run('backup now', backupNow)} disabled={busy} />
          <View style={s.backupLinks}>
            <Pressable onPress={() => void run('sign out', signOut)} disabled={busy} hitSlop={8} accessibilityRole="button">
              <AppText style={s.link} color={c.textMuted}>{t('backup.signOut')}</AppText>
            </Pressable>
            <Pressable onPress={confirmDelete} disabled={busy} hitSlop={8} accessibilityRole="button">
              <AppText style={s.link} color={c.textMuted}>{t('backup.delete')}</AppText>
            </Pressable>
          </View>
        </>
      )}
    </Section>
  );
}

function NotificationSettings() {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
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
    <Section icon="notifications" title={t('settings.notifications')}>
      {!allowed && (
        <View style={[s.banner, { backgroundColor: c.accentSoft }]}>
          <AppText variant="caption" color={c.accentText} style={s.flex}>{t('settings.notificationsOff')}</AppText>
          <Pressable onPress={() => void turnOn()} hitSlop={8} accessibilityRole="button">
            <AppText style={s.link} color={c.accentText}>{t('settings.turnOn')}</AppText>
          </Pressable>
        </View>
      )}

      <ToggleRow
        title={t('settings.milestoneAlerts')}
        sub={t('settings.milestoneAlertsSub')}
        value={milestoneAlerts}
        onChange={(on) => void actions.setMilestoneAlerts(on)}
      />
      <ToggleRow
        title={t('settings.checkin')}
        sub={t('settings.checkinSub')}
        value={checkin.enabled}
        onChange={(on) => void actions.setCheckin({ enabled: on })}
      />

      {checkin.enabled && (
        <Pressable onPress={() => setPicking(true)} style={s.row} accessibilityRole="button">
          <AppText style={[s.rowTitle, s.flex]}>{t('settings.checkinTime')}</AppText>
          <View style={[s.timePill, { backgroundColor: c.surfaceAlt }]}>
            <Ionicons name="time-outline" size={16} color={c.accentText} />
            <AppText style={s.rowTitle} color={c.accentText}>{timeLabel}</AppText>
          </View>
        </Pressable>
      )}

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
    </Section>
  );
}

function ToggleRow({ title, sub, value, onChange }: {
  title: string; sub: string; value: boolean; onChange: (on: boolean) => void;
}) {
  const c = useColors();
  return (
    <View style={s.row}>
      <View style={s.flex}>
        <AppText style={s.rowTitle}>{title}</AppText>
        <AppText variant="caption">{sub}</AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: c.surfaceAlt, true: c.accent }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={c.surfaceAlt}
        accessibilityLabel={title}
      />
    </View>
  );
}

export function Section({ icon, title, children }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; title: string; children: React.ReactNode;
}) {
  const c = useColors();
  return (
    <Card style={s.section}>
      <View style={s.header}>
        <View style={[s.icon, { backgroundColor: c.accentSoft }]}>
          <Ionicons name={icon} size={18} color={c.accent} />
        </View>
        <AppText variant="heading">{title}</AppText>
      </View>
      {children}
    </Card>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  title: { marginBottom: 20 },
  section: { marginBottom: 14, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  habitIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  timePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.sm },
  link: { fontSize: 14, fontWeight: '700' },
  backupLinks: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  footer: { alignItems: 'center', gap: 6, marginTop: 18 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
