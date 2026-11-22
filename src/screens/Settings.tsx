import React from 'react';
import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { LANGS, setLanguage, useLang } from '../i18n';
import { ThemePref, useThemePref } from '../lib/storage';
import { setThemePref, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';

export function SettingsScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const theme = useThemePref();
  const c = useColors();

  const themes: { value: ThemePref; label: string }[] = [
    { value: 'system', label: t('settings.system') },
    { value: 'light', label: t('settings.light') },
    { value: 'dark', label: t('settings.dark') },
  ];

  return (
    <Screen scroll>
      <AppText variant="title" style={s.title}>{t('settings.title')}</AppText>

      <Section icon="language" title={t('settings.language')}>
        <Segmented options={LANGS.map((l) => ({ value: l.id, label: l.label }))} value={lang} onChange={setLanguage} />
      </Section>

      <Section icon="contrast" title={t('settings.appearance')}>
        <Segmented options={themes} value={theme} onChange={setThemePref} />
      </Section>

      <View style={s.footer}>
        <View style={s.privacy}>
          <Ionicons name="lock-closed" size={14} color={c.textMuted} />
          <AppText variant="caption">{t('settings.privacy')}</AppText>
        </View>
        <AppText variant="caption">{t('settings.version', { version: Constants.expoConfig?.version ?? '' })}</AppText>
      </View>
    </Screen>
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
  title: { marginBottom: 20 },
  section: { marginBottom: 14, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', gap: 6, marginTop: 18 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
