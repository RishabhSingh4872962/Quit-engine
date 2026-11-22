import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoSource, VideoView } from 'expo-video';
import { StaticScreenProps, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useLang } from '../i18n';
import { stopMedia } from '../lib/sounds';
import { findMedia, mediaTitle } from '../media/catalog';
import { AppText } from '../components/AppText';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';

type Props = StaticScreenProps<{ id: string }>;

// One source object per URL, so the player isn't recreated on every render. Cached on the phone
// after the first play (saves mobile data on replays).
const sources = new Map<string, VideoSource>();
const sourceFor = (uri: string) => {
  if (!sources.has(uri)) sources.set(uri, { uri, useCaching: true });
  return sources.get(uri) ?? null;
};

/** Plays one calm video from the media catalog. */
export function VideoScreen({ route }: Props) {
  const { t } = useTranslation();
  const lang = useLang();
  const navigation = useNavigation();
  const item = findMedia(route.params.id);
  const uri = item?.kind === 'video' && typeof item.source === 'string' ? item.source : null;
  const player = useVideoPlayer(uri ? sourceFor(uri) : null, (p) => p.play());
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  // Sounds and the video would talk over each other.
  useEffect(() => stopMedia(), []);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={s.topRow}>
        <AppText variant="heading" style={s.flex} numberOfLines={2}>{item ? mediaTitle(item, lang) : ''}</AppText>
        <IconButton icon="close" label={t('setup.close')} onPress={navigation.goBack} filled />
      </View>
      <VideoView player={player} style={s.video} contentFit="contain" nativeControls fullscreenOptions={{ enable: true }} />
      {(status === 'error' || !uri) && <AppText variant="muted" center>{t('focus.videoError')}</AppText>}
      {item?.by && <AppText variant="caption" center>{t('focus.by', { name: item.by })}</AppText>}
    </Screen>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  video: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', marginBottom: 12 },
});
