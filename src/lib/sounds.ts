import { useSyncExternalStore } from 'react';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import i18n from '../i18n';
import { MediaItem, mediaTitle } from '../media/catalog';
import { requestPermission } from './notifications';
import { reportError } from './telemetry';

/**
 * One app-wide audio player for focus sounds, music and guided audio, so playback continues across
 * screens and with the screen off. On Android, background playback needs the lock-screen media
 * controls (otherwise the OS stops it after ~3 minutes), and those need notification permission.
 * Nothing here is logged or sent anywhere.
 */

let player: AudioPlayer | null = null;
let current: string | null = null; // id of the item loaded in the player
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** The shared player (created on first use, empty until something plays). */
export function audioPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 500 });
    player.addListener('playbackStatusUpdate', (status) => {
      // Guided audio ends by itself; clear it so the UI and lock screen reset.
      if (status.didJustFinish && !status.loop) stopMedia();
    });
  }
  return player;
}

let modeReady: Promise<void> | null = null;
const ensureAudioMode = () =>
  (modeReady ??= setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }));

/** Plays an item from the start (or resumes it if it is the one already loaded). */
export async function playMedia(item: MediaItem) {
  try {
    await ensureAudioMode();
    void requestPermission(); // for the media notification (lock-screen controls)
    const p = audioPlayer();
    if (current !== item.id) {
      p.replace(item.source);
      p.loop = item.loop;
      current = item.id;
    }
    p.play();
    p.setActiveForLockScreen(
      true,
      { title: mediaTitle(item, i18n.language === 'hi' ? 'hi' : 'en'), artist: item.by ?? 'Quit Engine' },
      { showSeekBackward: false, showSeekForward: false },
    );
    emit();
  } catch (e) {
    reportError(e, 'playMedia');
  }
}

export function pauseMedia() {
  player?.pause();
  emit();
}

/** Stops playback and removes the lock-screen controls. */
export function stopMedia() {
  if (!player || current === null) return;
  try {
    player.pause();
    player.clearLockScreenControls();
  } catch (e) {
    reportError(e, 'stopMedia');
  }
  current = null;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Id of the loaded item (playing or paused), or null. */
export const useCurrentMedia = () => useSyncExternalStore(subscribe, () => current);
export const currentMedia = () => current;
