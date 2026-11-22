import { Linking, Platform } from 'react-native';
import Purchases, { PACKAGE_TYPE } from 'react-native-purchases';
import type { CustomerInfo, PurchasesError, PurchasesPackage } from 'react-native-purchases';
import { useMMKVBoolean } from 'react-native-mmkv';
import { HABITS } from '../habits';
import { HabitId } from '../habits/types';
import { screenTimeAvailable } from './screenTime';
import { storage } from './storage';
import { reportError } from './telemetry';

/**
 * Premium via RevenueCat (Google Play Billing underneath, so UPI and cards work in India).
 * The core app is free; Premium unlocks extras (today: Reels screen time).
 *
 * The public SDK key comes from EXPO_PUBLIC_REVENUECAT_ANDROID_KEY (.env). Without it, debug
 * builds run a test mode with fake plans so the flow can be tried before the stores are set up.
 *
 * Privacy: no analytics events here. Paywall views would hint at the Reels habit, since
 * screen time is its Premium feature. RevenueCat's dashboard covers revenue numbers.
 */

const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
const ENTITLEMENT = 'premium'; // entitlement identifier in the RevenueCat dashboard
const PREMIUM_KEY = 'premium.active'; // last known state, so Premium works offline and without a loading state
const PLAY_SUBSCRIPTIONS = 'https://play.google.com/store/account/subscriptions?package=com.quitengine.app';

const apiKey = Platform.OS === 'android' ? ANDROID_KEY : undefined;
/** True in debug builds without a RevenueCat key: fake plans, purchases only flip a local flag. */
export const premiumTestMode = __DEV__ && !apiKey;
/** Purchases can happen (real store, or test mode). False on iOS for now. */
export const premiumAvailable = Boolean(apiKey) || premiumTestMode;

export interface Plan {
  id: string;
  kind: 'monthly' | 'annual' | 'lifetime' | 'other';
  price: string; // formatted by the store, e.g. "₹499.00"
  perMonth: string | null; // annual plans only, e.g. "₹41.58"
  freeTrialDays: number | null;
  pkg: PurchasesPackage | null; // null in test mode
}

const setPremium = (active: boolean) => storage.set(PREMIUM_KEY, active);
const fromCustomerInfo = (info: CustomerInfo) => setPremium(ENTITLEMENT in info.entitlements.active);

let configured = false;

/**
 * Connects to RevenueCat once (safe to call again). Called when the app UI starts and before
 * any purchase call, never from the background widget task, so Billing only starts when needed.
 */
export function initPremium() {
  if (!apiKey || configured) return;
  configured = true;
  try {
    Purchases.configure({ apiKey }); // anonymous RevenueCat user: no account or email needed
    Purchases.addCustomerInfoUpdateListener(fromCustomerInfo); // also fires on renewals and refunds
    Purchases.getCustomerInfo().then(fromCustomerInfo, (e: unknown) => reportError(e, 'premium status'));
  } catch (e) {
    reportError(e, 'premium init');
  }
}

/** Whether Premium would unlock anything for these habits on this phone (today: Reels screen time on Android). */
export const premiumHasValueFor = (tracked: HabitId[]) =>
  premiumAvailable && screenTimeAvailable && tracked.some((id) => HABITS[id].screenTime);

export const readPremium = () => storage.getBoolean(PREMIUM_KEY) ?? false;

/** Re-renders when Premium starts or ends. */
export function usePremium(): boolean {
  const [active] = useMMKVBoolean(PREMIUM_KEY, storage);
  return active ?? false;
}

const kindOf = (type: PACKAGE_TYPE): Plan['kind'] =>
  type === PACKAGE_TYPE.MONTHLY ? 'monthly'
    : type === PACKAGE_TYPE.ANNUAL ? 'annual'
      : type === PACKAGE_TYPE.LIFETIME ? 'lifetime'
        : 'other';

function trialDays(pkg: PurchasesPackage): number | null {
  const free = pkg.product.defaultOption?.freePhase?.billingPeriod;
  if (!free) return null;
  const perUnit = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365, UNKNOWN: 0 }[free.unit];
  return free.value * perUnit || null;
}

const TEST_PLANS: Plan[] = [
  { id: 'test_annual', kind: 'annual', price: '₹499.00', perMonth: '₹41.58', freeTrialDays: 7, pkg: null },
  { id: 'test_monthly', kind: 'monthly', price: '₹99.00', perMonth: null, freeTrialDays: null, pkg: null },
];

/** Plans in the current RevenueCat offering (yearly first), or [] if the store can't be reached. */
export async function loadPlans(): Promise<Plan[]> {
  if (premiumTestMode) return TEST_PLANS;
  if (!apiKey) return [];
  initPremium();
  const offering = (await Purchases.getOfferings()).current;
  const plans = (offering?.availablePackages ?? []).map((pkg): Plan => ({
    id: pkg.identifier,
    kind: kindOf(pkg.packageType),
    price: pkg.product.priceString,
    perMonth: pkg.packageType === PACKAGE_TYPE.ANNUAL ? pkg.product.pricePerMonthString : null,
    freeTrialDays: trialDays(pkg),
    pkg,
  }));
  const order: Plan['kind'][] = ['annual', 'monthly', 'lifetime', 'other'];
  return plans.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

/** Opens Google Play's purchase sheet. Resolves false if the user backed out. */
export async function buy(plan: Plan): Promise<boolean> {
  if (premiumTestMode) {
    setPremium(true);
    return true;
  }
  if (!plan.pkg) return false;
  initPremium();
  try {
    const { customerInfo } = await Purchases.purchasePackage(plan.pkg);
    fromCustomerInfo(customerInfo);
    return ENTITLEMENT in customerInfo.entitlements.active;
  } catch (e) {
    if ((e as PurchasesError).code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return false;
    throw e;
  }
}

/** Looks for an earlier purchase on this Google account. Resolves true if Premium is now active. */
export async function restore(): Promise<boolean> {
  if (premiumTestMode) return storage.getBoolean(PREMIUM_KEY) ?? false;
  if (!apiKey) return false;
  initPremium();
  const info = await Purchases.restorePurchases();
  fromCustomerInfo(info);
  return ENTITLEMENT in info.entitlements.active;
}

/** Google Play's subscription page, where people cancel or change plans. */
export async function manageSubscription() {
  if (premiumTestMode) return setPremium(false); // test mode: "cancel" right away
  let url = PLAY_SUBSCRIPTIONS;
  initPremium();
  try {
    url = (await Purchases.getCustomerInfo()).managementURL ?? url;
  } catch (e) {
    reportError(e, 'management url');
  }
  await Linking.openURL(url);
}
