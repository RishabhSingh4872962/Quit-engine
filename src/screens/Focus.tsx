import React, { useEffect, useRef } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayerStatus } from 'expo-audio';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HABITS } from '../habits';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import { FOCUS_OPTIONS, focusEnd, readExactAsked, useFocusDone, useFocusPrefs, useFocusSession, useFocusTotals } from '../lib/focus';
import { clock, formatDuration } from '../lib/format';
import { allowExactAlarms, exactAlarmsAllowed } from '../lib/notifications';
import { premiumAvailable, usePremium } from '../lib/premium';
import { reelCounterAvailable, useReelCounter } from '../lib/reels';
import { audioPlayer, pauseMedia, playMedia, stopMedia, useCurrentMedia } from '../lib/sounds';
import { useTracked } from '../lib/storage';
import { useNow } from '../lib/streak';
import { MediaItem, mediaCatalog, mediaTitle } from '../media/catalog';
import { fonts, radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { Segmented } from '../components/Segmented';
import { StreakRing } from '../components/StreakRing';
import { ToggleRow } from '../components/ToggleRow';

/**
 * Focus tab: a focus timer (optionally pausing reels, Premium), sounds that keep playing with the
 * screen off, guided audio and calm videos. Everything here stays on the phone.
 */
export function FocusScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const c = useColors();
  const navigation = useNavigation();
  const session = useFocusSession();
  const prefs = useFocusPrefs();
  const done = useFocusDone();
  const now = useNow(session ? 1000 : 60_000);
  const totals = useFocusTotals(now);
  const tracked = useTracked();
  const premium = usePremium();
  const { enabled: counterOn } = useReelCounter(1);
  const current = useCurrentMedia();
  const status = useAudioPlayerStatus(audioPlayer());

  // Completes the session when its time is up while the app is open.
  useEffect(() => {
    if (session && now >= focusEnd(session)) actions.checkFocus();
  }, [session, now]);

  // A small "well done" buzz when a session completes (not when the screen first opens).
  const lastDone = useRef(done);
  useEffect(() => {
    if (done?.complete && done !== lastDone.current) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    lastDone.current = done;
  }, [done]);

  const items = mediaCatalog();
  const sounds = items.filter((m) => m.kind === 'sound' || m.kind === 'music');
  const guided = items.filter((m) => m.kind === 'guided');
  const videos = items.filter((m) => m.kind === 'video');

  // "Pause reels while focusing" reuses reel blocking, so it needs Premium and the reel counter.
  const canBlock = reelCounterAvailable && (premium || premiumAvailable) && tracked.some((id) => HABITS[id].reelApps);
  const blockOn = premium && counterOn && prefs.blockReels;
  const setBlock = (on: boolean) => {
    if (!premium) return navigation.navigate('Paywall');
    if (!counterOn) return navigation.navigate('ReelCounterSetup');
    actions.setFocusPrefs({ blockReels: on });
  };

  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  // `now` can lag a tick behind a fresh start, so clamp to the session length.
  const remaining = session ? Math.min(session.minutes * 60_000, focusEnd(session) - now) : prefs.minutes * 60_000;
  const progress = session
    ? Math.min(1, Math.max(0, 1 - remaining / (session.minutes * 60_000)))
    : done?.complete ? 1 : 0;

  const confirmEnd = () =>
    Alert.alert(t('focus.endTitle'), t('focus.endBody'), [
      { text: t('focus.keepGoing'), style: 'cancel' },
      { text: t('focus.endConfirm'), onPress: actions.endFocus },
    ]);
  // Once, at the first session: Android 14+ needs the user's OK to ring exactly at the end.
  const askExactAlarmsOnce = async () => {
    if (readExactAsked() || (await exactAlarmsAllowed())) return;
    actions.markExactAlarmsAsked();
    Alert.alert(t('focus.exactTitle'), t('focus.exactBody'), [
      { text: t('reels.notNow'), style: 'cancel' },
      { text: t('focus.exactAllow'), onPress: () => void allowExactAlarms() },
    ]);
  };
  const start = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    actions.startFocus(prefs.minutes, blockOn);
    void askExactAlarmsOnce();
  };
  // Loops stop; guided audio pauses, so it can continue where it was.
  const toggle = (m: MediaItem) => {
    if (current !== m.id || !status.playing) return void playMedia(m);
    if (m.loop) stopMedia();
    else pauseMedia();
  };

  return (
    <Screen scroll>
      <View style={s.header}>
        <AppText variant="title">{t('focus.title')}</AppText>
        <AppText variant="muted">{t('focus.sub')}</AppText>
      </View>

      <Card style={s.timerCard}>
        <StreakRing progress={progress} size={232} stroke={14}>
          {done && !session ? (
            <Ionicons name="checkmark" size={56} color={c.accent} />
          ) : (
            <>
              <AppText style={s.clock} color={c.accentText}>{clock(remaining)}</AppText>
              <AppText variant="caption">
                {session ? t('focus.of', { count: session.minutes }) : t('focus.ready')}
              </AppText>
            </>
          )}
        </StreakRing>

        {session ? (
          <View style={s.full}>
            {session.blockReels && premium && (
              <AppText variant="caption" center>
                {t('focus.blockingNow', {
                  time: new Date(focusEnd(session)).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }),
                })}
              </AppText>
            )}
            <Button variant="ghost" label={t('focus.end')} onPress={confirmEnd} />
          </View>
        ) : done ? (
          <Animated.View entering={FadeIn.duration(400)} style={s.full}>
            <AppText variant="heading" center>{done.complete ? t('focus.doneTitle') : t('focus.doneEarlyTitle')}</AppText>
            <AppText variant="muted" center>
              {t(done.complete ? 'focus.doneBody' : 'focus.doneEarlyBody', { count: done.minutes })}
            </AppText>
            <Button icon="play" label={t('focus.again')} onPress={start} />
            <Button variant="ghost" label={t('focus.ok')} onPress={actions.dismissFocusDone} />
          </Animated.View>
        ) : (
          <View style={s.full}>
            <Segmented
              options={FOCUS_OPTIONS.map((n) => ({ value: String(n), label: t('focus.minutes', { count: n }) }))}
              value={String(prefs.minutes)}
              onChange={(v) => actions.setFocusPrefs({ minutes: Number(v) })}
            />
            {canBlock && (
              <ToggleRow
                title={t('focus.blockReels')}
                sub={
                  !premium
                    ? `${t('premium.title')} · ${t('focus.blockReelsSub')}`
                    : counterOn ? t('focus.blockReelsSub') : t('focus.blockReelsSetup')
                }
                value={blockOn}
                onChange={setBlock}
              />
            )}
            <Button icon="play" label={t('focus.start')} onPress={start} />
          </View>
        )}
      </Card>

      <Card style={s.totals}>
        <View style={s.stat}>
          <AppText variant="label">{t('focus.today')}</AppText>
          <AppText style={s.statValue} color={c.accentText}>{formatDuration(totals.today * 60_000, t)}</AppText>
        </View>
        <View style={[s.divider, { backgroundColor: c.border }]} />
        <View style={s.stat}>
          <AppText variant="label">{t('focus.week')}</AppText>
          <AppText style={s.statValue}>{formatDuration(totals.week * 60_000, t)}</AppText>
        </View>
      </Card>

      <Card style={s.card}>
        <AppText variant="heading">{t('focus.soundsTitle')}</AppText>
        <AppText variant="caption">{t('focus.soundsSub')}</AppText>
        <View style={s.grid}>
          {sounds.map((m) => {
            const active = current === m.id;
            const playing = active && status.playing;
            const title = mediaTitle(m, lang);
            return (
              <Pressable
                key={m.id}
                onPress={() => toggle(m)}
                style={({ pressed }) => [
                  s.tile,
                  { backgroundColor: active ? c.accent : c.surfaceAlt, opacity: pressed ? 0.85 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: playing }}
                accessibilityLabel={playing ? t('focus.stop', { name: title }) : t('focus.play', { name: title })}
              >
                <Ionicons name={playing ? 'pause' : m.icon} size={24} color={active ? c.onAccent : c.accentText} />
                <AppText style={s.tileTitle} color={active ? c.onAccent : c.text} numberOfLines={1}>{title}</AppText>
                {m.by && (
                  <AppText variant="caption" color={active ? c.onAccent : undefined} numberOfLines={1}>{m.by}</AppText>
                )}
              </Pressable>
            );
          })}
        </View>
      </Card>

      {guided.length > 0 && (
        <Card style={s.card}>
          <AppText variant="heading">{t('focus.guidedTitle')}</AppText>
          {guided.map((m) => {
            const active = current === m.id;
            const playing = active && status.playing;
            const title = mediaTitle(m, lang);
            const pct = active && status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
            return (
              <Pressable
                key={m.id}
                onPress={() => toggle(m)}
                style={s.row}
                accessibilityRole="button"
                accessibilityLabel={playing ? t('focus.stop', { name: title }) : t('focus.play', { name: title })}
              >
                <View style={[s.rowIcon, { backgroundColor: c.accentSoft }]}>
                  <Ionicons name={playing ? 'pause' : 'play'} size={18} color={c.accentText} />
                </View>
                <View style={s.flex}>
                  <AppText style={s.rowTitle}>{title}</AppText>
                  <AppText variant="caption">
                    {[m.minutes ? t('focus.length', { count: m.minutes }) : null, m.by ? t('focus.by', { name: m.by }) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </AppText>
                  {active && (
                    <View style={[s.track, { backgroundColor: c.surfaceAlt }]}>
                      <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: c.accent }]} />
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </Card>
      )}

      {videos.length > 0 && (
        <Card style={s.card}>
          <AppText variant="heading">{t('focus.videosTitle')}</AppText>
          {videos.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => navigation.navigate('Video', { id: m.id })}
              style={s.row}
              accessibilityRole="button"
            >
              <View style={[s.rowIcon, { backgroundColor: c.accentSoft }]}>
                <Ionicons name="play-circle-outline" size={20} color={c.accentText} />
              </View>
              <View style={s.flex}>
                <AppText style={s.rowTitle}>{mediaTitle(m, lang)}</AppText>
                {(m.minutes || m.by) && (
                  <AppText variant="caption">
                    {[m.minutes ? t('focus.length', { count: m.minutes }) : null, m.by ? t('focus.by', { name: m.by }) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </AppText>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  full: { alignSelf: 'stretch', gap: 12 },
  header: { gap: 2, marginBottom: 16 },
  timerCard: { alignItems: 'center', gap: 18 },
  clock: { fontFamily: fonts.bold, fontSize: 44, lineHeight: 54, includeFontPadding: false },
  totals: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30, includeFontPadding: false },
  divider: { width: 1, alignSelf: 'stretch' },
  card: { gap: 10, marginTop: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  tile: { flexBasis: '47%', flexGrow: 1, padding: 14, borderRadius: radius.md, gap: 6 },
  tileTitle: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  track: { height: 4, borderRadius: radius.pill, overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%' },
});
