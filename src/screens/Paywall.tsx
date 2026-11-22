import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { buy, loadPlans, Plan, premiumTestMode, restore, usePremium } from '../lib/premium';
import { reportError } from '../lib/telemetry';
import { radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { OptionCard } from '../components/OptionCard';
import { Screen } from '../components/Screen';

type Feature = { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string };

const perPeriod = (plan: Plan, t: TFunction) =>
  plan.kind === 'monthly' ? t('paywall.perMonth') : plan.kind === 'annual' ? t('paywall.perYear') : '';

/** Price line on a plan card: "₹499.00 per year · ₹41.58/month". */
function priceLine(plan: Plan, t: TFunction) {
  const base = plan.kind === 'lifetime' || plan.kind === 'other' ? plan.price : `${plan.price} ${perPeriod(plan, t)}`;
  return plan.perMonth ? t('paywall.withMonthly', { base, perMonth: plan.perMonth }) : base;
}

/** What a plan costs and when, in one plain sentence (shown right under the buy button). */
function terms(plan: Plan, t: TFunction) {
  const per = perPeriod(plan, t);
  if (plan.kind === 'lifetime') return t('paywall.termsLifetime', { price: plan.price });
  if (plan.freeTrialDays) return t('paywall.termsTrial', { count: plan.freeTrialDays, price: plan.price, per });
  return t('paywall.terms', { price: plan.price, per });
}

/**
 * Soft paywall: always closable, prices and renewal terms in plain words, no countdowns.
 * Shown once after onboarding (if a tracked habit has Premium features) and from locked features.
 */
export function PaywallScreen() {
  const { t } = useTranslation();
  const c = useColors();
  const navigation = useNavigation();
  const premium = usePremium();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    loadPlans()
      .then((p) => {
        if (!mounted) return;
        setPlans(p);
        setFailed(p.length === 0);
        setSelected((s) => s ?? p[0]?.id ?? null); // yearly first, as sorted
      })
      .catch((e: unknown) => {
        reportError(e, 'load plans');
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, [attempt]);

  const plan = plans?.find((p) => p.id === selected);

  const run = async (action: () => Promise<boolean>, emptyMessage?: string) => {
    setBusy(true);
    try {
      const ok = await action();
      if (ok) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else if (emptyMessage) Alert.alert(emptyMessage);
    } catch (e) {
      reportError(e, 'purchase');
      Alert.alert(t('paywall.errorTitle'), t('paywall.errorBody'));
    } finally {
      setBusy(false);
    }
  };

  const features: Feature[] = [
    { icon: 'time', title: t('paywall.f1Title'), body: t('paywall.f1Body') },
    { icon: 'options', title: t('paywall.f2Title'), body: t('paywall.f2Body') },
    { icon: 'heart', title: t('paywall.f3Title'), body: t('paywall.f3Body') },
  ];

  if (premium) {
    return (
      <Screen edges={['top', 'bottom']} style={s.center}>
        <Animated.View entering={ZoomIn.springify().damping(20)} style={[s.badge, { backgroundColor: c.accent }]}>
          <Ionicons name="checkmark" size={48} color={c.onAccent} />
        </Animated.View>
        <AppText variant="title" center>{t('paywall.thanksTitle')}</AppText>
        <AppText variant="muted" center style={s.thanksBody}>{t('paywall.thanksBody')}</AppText>
        <Button label={t('paywall.done')} onPress={navigation.goBack} style={s.stretch} />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <View style={s.topRow}>
        {premiumTestMode ? (
          <View style={[s.testChip, { backgroundColor: c.surfaceAlt }]}>
            <AppText variant="caption">{t('paywall.testMode')}</AppText>
          </View>
        ) : <View />}
        <IconButton icon="close" label={t('setup.close')} onPress={navigation.goBack} filled />
      </View>

      <Animated.View entering={FadeIn.duration(400)} style={s.hero}>
        <View style={[s.badge, { backgroundColor: c.accentSoft }]}>
          <Ionicons name="sparkles" size={36} color={c.accent} />
        </View>
        <AppText variant="title" center>{t('paywall.title')}</AppText>
        <AppText variant="muted" center>{t('paywall.subtitle')}</AppText>
      </Animated.View>

      <View style={s.features}>
        {features.map((f) => (
          <View key={f.icon} style={s.feature}>
            <View style={[s.featureIcon, { backgroundColor: c.accentSoft }]}>
              <Ionicons name={f.icon} size={18} color={c.accent} />
            </View>
            <View style={s.flex}>
              <AppText style={s.featureTitle}>{f.title}</AppText>
              <AppText variant="caption">{f.body}</AppText>
            </View>
          </View>
        ))}
      </View>

      {plans === null && !failed && <ActivityIndicator color={c.accent} style={s.loading} />}

      {failed && (
        <View style={s.failed}>
          <AppText variant="muted" center>{t('paywall.unavailable')}</AppText>
          <Button variant="soft" label={t('paywall.retry')} onPress={() => { setFailed(false); setPlans(null); setAttempt((n) => n + 1); }} />
        </View>
      )}

      {plans?.map((p) => (
        <OptionCard
          key={p.id}
          label={t(`paywall.plan.${p.kind}`)}
          sub={priceLine(p, t)}
          badge={p.freeTrialDays ? t('paywall.trialBadge', { count: p.freeTrialDays }) : undefined}
          selected={p.id === selected}
          onPress={() => setSelected(p.id)}
        />
      ))}

      {plan && (
        <>
          <Button
            label={plan.freeTrialDays ? t('paywall.startTrial', { count: plan.freeTrialDays }) : t('paywall.continue')}
            onPress={() => void run(() => buy(plan))}
            disabled={busy}
            style={s.cta}
          />
          <AppText variant="caption" center style={s.terms}>{terms(plan, t)}</AppText>
        </>
      )}

      <View style={s.footer}>
        <Button variant="ghost" label={t('paywall.restore')} onPress={() => void run(restore, t('paywall.nothingToRestore'))} disabled={busy} />
        <Button variant="ghost" label={t('paywall.notNow')} onPress={navigation.goBack} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  stretch: { alignSelf: 'stretch', marginTop: 16 },
  thanksBody: { marginBottom: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  testChip: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  hero: { alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 24 },
  badge: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  features: { gap: 16, marginBottom: 28 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontSize: 16, fontWeight: '600' },
  loading: { marginVertical: 24 },
  failed: { gap: 12, marginBottom: 12 },
  cta: { marginTop: 4 },
  terms: { marginTop: 10 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
});
