import React, { useEffect, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AudioSession,
  isTrackReference,
  LiveKitRoom,
  useIsSpeaking,
  useLocalParticipant,
  useRoomContext,
  useTracks,
  VideoTrack,
} from '@livekit/react-native';
import { Track } from 'livekit-client';
import type { TrackReferenceOrPlaceholder } from '@livekit/react-native';
import { useTranslation } from 'react-i18next';
import { askPermission, CallError, getCallToken } from '../lib/calls';
import { reportError } from '../lib/telemetry';
import { radius, useColors } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { LIVE } from './RoomCard';

/**
 * Voice call (camera optional) for an invite-only room. Nothing is recorded. The call ends when the
 * app goes to the background, so the microphone is never on without the app on screen.
 */
export function CallPanel({ roomId }: { roomId: string }) {
  const { t } = useTranslation();
  const [conn, setConn] = useState<{ token: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await askPermission('mic'))) return Alert.alert(t('calls.title'), t('calls.micNeeded'));
      const c = await getCallToken(roomId);
      await AudioSession.startAudioSession();
      setConn(c);
    } catch (e) {
      const reason = e instanceof CallError ? e.reason : 'failed';
      if (reason === 'failed') reportError(e, 'call join');
      Alert.alert(t('calls.title'), t(`calls.error_${reason}`));
    } finally {
      setBusy(false);
    }
  };
  const leave = () => {
    setConn(null);
    void AudioSession.stopAudioSession();
  };

  if (!conn) {
    return (
      <Card style={s.card}>
        <View style={s.row}>
          <Ionicons name="call-outline" size={20} color={LIVE} />
          <AppText variant="heading">{t('calls.title')}</AppText>
        </View>
        <AppText variant="caption">{t('calls.sub')}</AppText>
        <Button icon="mic-outline" label={t('calls.join')} onPress={() => void join()} disabled={busy} />
      </Card>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={conn.url}
      token={conn.token}
      connect
      audio
      video={false}
      onDisconnected={leave}
      onError={(e) => reportError(e, 'call')}
    >
      <CallStage onLeave={leave} />
    </LiveKitRoom>
  );
}

function CallStage({ onLeave }: { onLeave: () => void }) {
  const { t } = useTranslation();
  const c = useColors();
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);

  // Calls only run with the app on screen.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') void room.disconnect();
    });
    return () => sub.remove();
  }, [room]);

  const toggleCamera = async () => {
    if (!isCameraEnabled && !(await askPermission('camera'))) return;
    await localParticipant.setCameraEnabled(!isCameraEnabled).catch((e: unknown) => reportError(e, 'camera'));
  };

  return (
    <Card style={s.card}>
      <View style={s.row}>
        <View style={[s.dot, { backgroundColor: LIVE }]} />
        <AppText variant="heading">{t('calls.inCall', { count: tracks.length })}</AppText>
      </View>
      <View style={s.grid}>
        {tracks.map((tr) => (
          <Tile key={`${tr.participant.identity}`} trackRef={tr} />
        ))}
      </View>
      <View style={s.controls}>
        <Control
          icon={isMicrophoneEnabled ? 'mic' : 'mic-off'}
          label={isMicrophoneEnabled ? t('calls.mute') : t('calls.unmute')}
          onPress={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          active={isMicrophoneEnabled}
        />
        <Control
          icon={isCameraEnabled ? 'videocam' : 'videocam-off'}
          label={isCameraEnabled ? t('calls.cameraOff') : t('calls.cameraOn')}
          onPress={() => void toggleCamera()}
          active={isCameraEnabled}
        />
        <Pressable
          onPress={() => {
            void room.disconnect();
            onLeave();
          }}
          style={[s.leave, { backgroundColor: '#D64545' }]}
          accessibilityRole="button"
          accessibilityLabel={t('calls.leave')}
        >
          <Ionicons name="call" size={22} color="#FFFFFF" style={s.hangup} />
        </Pressable>
      </View>
      <AppText variant="caption" center color={c.textMuted}>{t('calls.privacy')}</AppText>
    </Card>
  );
}

function Tile({ trackRef }: { trackRef: TrackReferenceOrPlaceholder }) {
  const c = useColors();
  const speaking = useIsSpeaking(trackRef.participant);
  const name = trackRef.participant.name || '…';
  const video = isTrackReference(trackRef) && !trackRef.publication.isMuted;
  return (
    <View style={[s.tile, { backgroundColor: c.surfaceAlt, borderColor: speaking ? LIVE : 'transparent' }]}>
      {video ? (
        <VideoTrack trackRef={trackRef} style={s.video} objectFit="cover" mirror={trackRef.participant.isLocal} />
      ) : (
        <View style={[s.initial, { backgroundColor: c.accentSoft }]}>
          <AppText style={s.initialText} color={c.accentText}>{name.slice(0, 1).toUpperCase()}</AppText>
        </View>
      )}
      <AppText style={s.name} numberOfLines={1}>{name}</AppText>
    </View>
  );
}

function Control({ icon, label, onPress, active }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; active: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[s.control, { backgroundColor: active ? c.accentSoft : c.surfaceAlt }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={22} color={active ? c.accentText : c.textMuted} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { gap: 12, marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  video: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  initial: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  initialText: { fontSize: 28, fontWeight: '800' },
  name: { position: 'absolute', left: 8, right: 8, bottom: 6, fontWeight: '700', textAlign: 'center' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  control: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  leave: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  hangup: { transform: [{ rotate: '135deg' }] },
});
