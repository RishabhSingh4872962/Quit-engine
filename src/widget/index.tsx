import React from 'react';
import { Platform } from 'react-native';
import { requestPinWidget, requestWidgetUpdate } from 'react-native-android-widget';
import type { WidgetInfo, WidgetTaskHandlerProps } from 'react-native-android-widget';
import { BRAND_ACCENT, HABITS } from '../habits';
import i18n from '../i18n';
import { dayTotals, isReelCounterOn, readReelDays } from '../lib/reels';
import { readActive, readState } from '../lib/storage';
import { streakDays } from '../lib/streak';
import { reportError } from '../lib/telemetry';
import { makePalette } from '../theme';
import { StreakWidget } from './StreakWidget';

/** Must match the widget `name` in app.json (react-native-android-widget plugin). */
const STREAK_WIDGET = 'Streak';

/**
 * Streak of the habit selected in the app. Light and dark versions are both sent;
 * Android shows the one that matches the system theme.
 */
function renderStreakWidget({ width, height }: WidgetInfo) {
  const id = readActive();
  const days = id ? streakDays(readState(id).streakStart, Date.now()) : 0;
  const accent = id ? HABITS[id].accent : BRAND_ACCENT;
  // Reels watched today, when this habit counts reels (no habit name, just a number).
  const reelApps = id ? HABITS[id].reelApps : undefined;
  const sub = reelApps && isReelCounterOn()
    ? i18n.t('widget.reelsToday', { count: dayTotals(readReelDays(1).at(-1), reelApps.map((a) => a.id)).count })
    : undefined;
  const props = { days, unit: i18n.t('common.days', { count: days }), sub, size: Math.min(width, height) };
  return {
    light: <StreakWidget {...props} colors={makePalette(accent, 'light')} />,
    dark: <StreakWidget {...props} colors={makePalette(accent, 'dark')} />,
  };
}

/**
 * Called by Android (in the background, even when the app is closed) when a widget is
 * added, resized, or due for its hourly refresh (updatePeriodMillis in app.json).
 */
export async function widgetTaskHandler({ widgetAction, widgetInfo, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(renderStreakWidget(widgetInfo));
}

/** Redraws placed widgets right away, e.g. after a slip or switching habit. */
export function updateStreakWidget() {
  if (Platform.OS !== 'android') return;
  requestWidgetUpdate({ widgetName: STREAK_WIDGET, renderWidget: renderStreakWidget }).catch((e: unknown) =>
    reportError(e, 'widget update'),
  );
}

/**
 * Shows the launcher's "Add to home screen?" prompt (Android 8+). Resolves false when the
 * launcher can't do that, so the caller can explain how to add it by hand.
 */
export async function pinStreakWidget(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return await requestPinWidget({ widgetName: STREAK_WIDGET });
  } catch (e) {
    reportError(e, 'pin widget');
    return false;
  }
}

// "days" / "दिन" follows the app language.
i18n.on('languageChanged', updateStreakWidget);
