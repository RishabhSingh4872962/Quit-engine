import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayerStatus } from 'expo-audio';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { HABITS } from '../habits';
import { useLang } from '../i18n';
import { actions } from '../lib/actions';
import {
  FOCUS_OPTIONS,
  focusEnd,
  FocusMode,
  focusPhase,
  mySubjects,
  planFromPrefs,
  POMODORO_PRESETS,
  readExactAsked,
  sessionMode,
  STOPWATCH_CAP,
  useFocusDone,
  useFocusPrefs,
  useFocusSession,
  useFocusTotals,
} from '../lib/focus';
import { dndAvailable, openDndAccess, useDndReady } from '../lib/dnd';
import { clock, formatDuration } from '../lib/format';
import { allowExactAlarms, exactAlarmsAllowed } from '../lib/notifications';
import { premiumAvailable, usePremium } from '../lib/premium';
import { reelCounterAvailable, useReelCounter } from '../lib/reels';
import { audioPlayer, pauseMedia, playMedia, stopMedia, useCurrentMedia } from '../lib/sounds';
import { useTracked } from '../lib/storage';
import { useNow } from '../lib/streak';
import { MediaItem, mediaCatalog, mediaTitle } from '../media/catalog';
import { FOCUS_TAGS } from '../rooms/data';
import { fonts, radius, useColors } from '../theme';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { FlipToFocus } from '../components/FlipToFocus';
import { LIVE } from '../components/RoomCard';
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
  const dndReady = useDndReady();
  // Session options stay folded: the timer and Start come first; a one-line summary shows what's set.
  const [optionsOpen, setOptionsOpen] = useState(false);
  const now = useNow(session ? 1000 : 60_000);
  const totals = useFocusTotals(now);
  // The session that just ended took today's total past the daily goal.
  const goalJustMet = !!done && prefs.goal > 0 && totals.today >= prefs.goal && totals.today - done.minutes < prefs.goal;
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
  const optionsSummary = [
    prefs.tag ? t(`rooms.tags.${prefs.tag}`) : null,
    prefs.subject ? t(`focus.subjectNames.${prefs.subject}`) : null,
    prefs.dnd ? t('focus.dndShort') : null,
    prefs.flip ? t('focus.flipShort') : null,
    canBlock && blockOn ? t('focus.blockShort') : null,
  ].filter(Boolean).join(' · ');
  const mode: FocusMode = session ? sessionMode(session) : prefs.mode;
  const plan = planFromPrefs(prefs);
  // What the ring shows: time left in this phase (a stopwatch counts up). `now` can lag a tick
  // behind a fresh start, so values are clamped.
  let shown: number;
  let caption: string;
  let progress: number;
  let onBreak = false;
  if (session && mode === 'stopwatch') {
    shown = Math.max(0, now - session.startedAt);
    caption = t('focus.soFar');
    progress = Math.min(1, shown / (STOPWATCH_CAP * 60_000));
  } else if (session) {
    const p = focusPhase(session, now);
    shown = Math.min(p.total, p.left);
    onBreak = p.phase === 'break';
    caption = mode === 'pomodoro'
      ? t(onBreak ? 'focus.roundBreak' : 'focus.roundFocus', { round: p.round, rounds: p.rounds })
      : t('focus.of', { count: session.minutes });
    progress = Math.min(1, Math.max(0, 1 - shown / p.total));
  } else {
    shown = mode === 'stopwatch' ? 0 : plan.minutes * 60_000;
    caption = t('focus.ready');
    progress = done?.complete ? 1 : 0;
  }

  // A stopwatch ends when you stop it, so no "are you sure".
  const confirmEnd = () =>
    mode === 'stopwatch' ? actions.endFocus() : Alert.alert(t('focus.endTitle'), t(session?.earn ? 'focus.endEarnBody' : 'focus.endBody'), [
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
  // DND needs two permissions: Do Not Disturb access, and exact alarms so it ends with the session.
  const askDndPermissions = () => {
    if (!dndReady.access) {
      return Alert.alert(t('focus.dndAccessTitle'), t('focus.dndAccessBody'), [
        { text: t('reels.notNow'), style: 'cancel' },
        { text: t('focus.dndAccessOpen'), onPress: openDndAccess },
      ]);
    }
    if (!dndReady.exact) {
      Alert.alert(t('focus.exactTitle'), t('focus.dndExactBody'), [
        { text: t('reels.notNow'), style: 'cancel' },
        { text: t('focus.exactAllow'), onPress: () => void allowExactAlarms() },
      ]);
    }
  };
  const start = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    actions.startFocus(plan, blockOn);
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
      {session && prefs.flip && <FlipToFocus />}
      <View style={s.header}>
        <AppText variant="title">{t('focus.title')}</AppText>
        <AppText variant="muted">{t('focus.sub')}</AppText>
      </View>

      <View style={s.hero}>
        <StreakRing progress={progress} size={248} stroke={12}>
          {done && !session ? (
            <Ionicons name="checkmark" size={56} color={c.accent} />
          ) : (
            <>
              <AppText style={s.clock} color={onBreak ? LIVE : c.accentText}>{clock(shown)}</AppText>
              <AppText variant="caption" center>{caption}</AppText>
            </>
          )}
        </StreakRing>

        {session ? (
          <View style={s.full}>
            {session.tag && <AppText variant="caption" center>{t('focus.focusingOn', { tag: t(`rooms.tags.${session.tag}`) })}</AppText>}
            {session.dnd && (
              <AppText variant="caption" center>
                {t('focus.dndOn', { time: new Date(focusEnd(session)).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }) })}
              </AppText>
            )}
            {session.subject && (
              <AppText variant="caption" center>{t('focus.subjectNow', { subject: t(`focus.subjectNames.${session.subject}`) })}</AppText>
            )}
            {session.earn ? (
              <AppText variant="caption" center color={c.accentText}>{t('focus.earnRunning', { count: session.earn })}</AppText>
            ) : null}
            {session.blockReels && premium && (
              <AppText variant="caption" center>
                {t('focus.blockingNow', {
                  time: new Date(focusEnd(session)).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }),
                })}
              </AppText>
            )}
            <Button
              variant={mode === 'stopwatch' ? 'primary' : 'ghost'}
              icon={mode === 'stopwatch' ? 'stop' : undefined}
              label={mode === 'stopwatch' ? t('focus.finish') : t('focus.end')}
              onPress={confirmEnd}
            />
          </View>
        ) : done ? (
          <Animated.View entering={FadeIn.duration(400)} style={s.full}>
            <AppText variant="heading" center>{done.complete ? t('focus.doneTitle') : t('focus.doneEarlyTitle')}</AppText>
            <AppText variant="muted" center>
              {t(done.complete ? 'focus.doneBody' : 'focus.doneEarlyBody', { count: done.minutes })}
            </AppText>
            {goalJustMet && <AppText variant="caption" center color={LIVE} style={s.earned}>{t('study.goalReached')}</AppText>}
            {done.earned ? (
              <AppText variant="caption" center color={c.accentText} style={s.earned}>{t('focus.earned', { count: done.earned })}</AppText>
            ) : null}
            <Button icon="play" label={t('focus.again')} onPress={start} />
            <Button variant="ghost" label={t('focus.ok')} onPress={actions.dismissFocusDone} />
          </Animated.View>
        ) : (
          <View style={s.full}>
            <Segmented
              options={(['timer', 'pomodoro', 'stopwatch'] as const).map((m) => ({ value: m, label: t(`focus.modes.${m}`) }))}
              value={prefs.mode}
              onChange={(m) => actions.setFocusPrefs({ mode: m })}
            />
            {prefs.mode === 'timer' && (
              <Segmented
                options={FOCUS_OPTIONS.map((n) => ({ value: String(n), label: t('focus.minutes', { count: n }) }))}
                value={String(prefs.minutes)}
                onChange={(v) => actions.setFocusPrefs({ minutes: Number(v) })}
              />
            )}
            {prefs.mode === 'pomodoro' && (
              <>
                <Segmented
                  options={POMODORO_PRESETS.map((p, i) => ({ value: String(i), label: `${p.focus}/${p.brk} ×${p.rounds}` }))}
                  value={String(prefs.pomodoro)}
                  onChange={(v) => actions.setFocusPrefs({ pomodoro: Number(v) })}
                />
                <AppText variant="caption" center>
                  {t('focus.pomodoroSub', { focus: plan.minutes, brk: plan.brk ?? 0, rounds: plan.rounds ?? 1 })}
                </AppText>
              </>
            )}
            {prefs.mode === 'stopwatch' && <AppText variant="caption" center>{t('focus.stopwatchSub')}</AppText>}
            <Button icon="play" label={t('focus.start')} onPress={start} />
          </View>
        )}
      </View>

      {!session && !done && (
        <Card style={s.card}>
          <Pressable
            onPress={() => setOptionsOpen(!optionsOpen)}
            accessibilityRole="button"
            accessibilityLabel={`${t('focus.optionsTitle')}, ${optionsSummary || t('focus.optionsNone')}`}
            accessibilityState={{ expanded: optionsOpen }}
            style={s.optionsHead}
          >
            <View style={s.flex}>
              <AppText variant="heading">{t('focus.optionsTitle')}</AppText>
              <AppText variant="caption" numberOfLines={1}>{optionsSummary || t('focus.optionsNone')}</AppText>
            </View>
            <Ionicons name={optionsOpen ? 'chevron-up' : 'chevron-down'} size={20} color={c.textMuted} />
          </Pressable>
          {optionsOpen && (
            <View style={s.options}>
              <View style={s.tagBlock}>
                <AppText variant="label">{t('focus.focusingOnTitle')}</AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tagRow}>
                  {FOCUS_TAGS.map((id) => {
                    const on = prefs.tag === id;
                    return (
                      <Pressable
                        key={id}
                        onPress={() => actions.setFocusPrefs({ tag: on ? undefined : id })}
                        style={[s.tagChip, { backgroundColor: on ? c.accent : c.surfaceAlt }]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                      >
                        <AppText style={s.tagText} color={on ? c.onAccent : c.text}>{t(`rooms.tags.${id}`)}</AppText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={s.tagBlock}>
                <AppText variant="label">{t('focus.subjectTitle')}</AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tagRow}>
                  {mySubjects(prefs).map((id) => {
                    const on = prefs.subject === id;
                    return (
                      <Pressable
                        key={id}
                        onPress={() => actions.setFocusPrefs({ subject: on ? undefined : id })}
                        style={[s.tagChip, { backgroundColor: on ? c.accent : c.surfaceAlt }]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                      >
                        <AppText style={s.tagText} color={on ? c.onAccent : c.text}>{t(`focus.subjectNames.${id}`)}</AppText>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => navigation.navigate('Study')}
                    style={[s.tagChip, s.editChip, { borderColor: c.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('study.subjectsTitle')}
                  >
                    <Ionicons name="pencil" size={14} color={c.accentText} />
                    <AppText style={s.tagText} color={c.accentText}>{t('focus.editSubjects')}</AppText>
                  </Pressable>
                </ScrollView>
              </View>
              {dndAvailable && (
                <>
                  <ToggleRow
                    title={t('focus.dnd')}
                    sub={
                      prefs.dnd && !dndReady.access ? t('focus.dndNeedsAccess')
                        : prefs.dnd && !dndReady.exact ? t('focus.dndNeedsExact')
                          : t('focus.dndSub')
                    }
                    value={prefs.dnd}
                    onChange={(on) => {
                      actions.setFocusPrefs({ dnd: on });
                      if (on) askDndPermissions();
                    }}
                  />
                  {prefs.dnd && (!dndReady.access || !dndReady.exact) && (
                    <Button variant="soft" label={t('focus.dndAllow')} onPress={askDndPermissions} />
                  )}
                </>
              )}
              <ToggleRow title={t('focus.flip')} sub={t('focus.flipSub')} value={prefs.flip} onChange={(flip) => actions.setFocusPrefs({ flip })} />
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
            </View>
          )}
        </Card>
      )}

      <Pressable
        onPress={() => navigation.navigate('Study')}
        accessibilityRole="button"
        accessibilityLabel={[
          `${t('focus.today')}: ${formatDuration(totals.today * 60_000, t)}`,
          `${t('focus.week')}: ${formatDuration(totals.week * 60_000, t)}`,
          prefs.goal > 0
            ? totals.today >= prefs.goal
              ? t('study.goalMet')
              : t('study.goalProgress', { done: formatDuration(totals.today * 60_000, t), goal: formatDuration(prefs.goal * 60_000, t) })
            : '',
        ].filter(Boolean).join(', ')}
        accessibilityHint={t('study.open')}
        style={({ pressed }) => pressed && s.pressed}
      >
        <Card style={s.totalsCard}>
          <View style={s.totals}>
            <View style={s.stat}>
              <AppText variant="label">{t('focus.today')}</AppText>
              <AppText style={s.statValue} color={c.accentText}>{formatDuration(totals.today * 60_000, t)}</AppText>
            </View>
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <View style={s.stat}>
              <AppText variant="label">{t('focus.week')}</AppText>
              <AppText style={s.statValue}>{formatDuration(totals.week * 60_000, t)}</AppText>
            </View>
          </View>
          {prefs.goal > 0 && (
            <View style={s.goal}>
              <View style={[s.goalTrack, { backgroundColor: c.surfaceAlt }]}>
                <View
                  style={[
                    s.goalFill,
                    {
                      width: `${Math.min(100, (totals.today / prefs.goal) * 100)}%`,
                      backgroundColor: totals.today >= prefs.goal ? LIVE : c.accent,
                    },
                  ]}
                />
              </View>
              <AppText variant="caption">
                {totals.today >= prefs.goal
                  ? t('study.goalMet')
                  : t('study.goalProgress', { done: formatDuration(totals.today * 60_000, t), goal: formatDuration(prefs.goal * 60_000, t) })}
              </AppText>
            </View>
          )}
          <View style={s.more}>
            <AppText variant="caption" color={c.accentText} style={s.tagText}>{t('study.open')}</AppText>
            <Ionicons name="chevron-forward" size={14} color={c.accentText} />
          </View>
        </Card>
      </Pressable>

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
  hero: { alignItems: 'center', gap: 18, marginTop: 8 },
  optionsHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  options: { gap: 14, marginTop: 16 },
  tagBlock: { gap: 8 },
  tagRow: { gap: 8, paddingRight: 8 },
  tagChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  tagText: { fontWeight: '600' },
  earned: { fontWeight: '600' },
  clock: { fontFamily: fonts.bold, fontSize: 44, lineHeight: 54, includeFontPadding: false },
  totalsCard: { marginTop: 14, gap: 12 },
  totals: { flexDirection: 'row', alignItems: 'center' },
  pressed: { opacity: 0.85 },
  goal: { gap: 6 },
  goalTrack: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  goalFill: { height: 8, borderRadius: radius.pill },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  editChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, backgroundColor: 'transparent' },
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
