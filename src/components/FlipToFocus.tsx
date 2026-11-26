import React, { useEffect, useState } from 'react';
import { Modal, StatusBar, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Accelerometer } from 'expo-sensors';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';

const TICK_MS = 8000;

/**
 * "Flip to focus": while a session runs, putting the phone face down turns the screen black (cheap
 * on OLED) with a soft tick every few seconds; picking it up shows the app again. Mount it only
 * while it should work: it keeps the screen awake so the sensor keeps reporting.
 */
export function FlipToFocus() {
  useKeepAwake('flip-to-focus');
  const { t } = useTranslation();
  const [down, setDown] = useState(false);

  useEffect(() => {
    Accelerometer.setUpdateInterval(500);
    let downReadings = 0;
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      // Face down: gravity points out of the screen (z ≈ -1 g) and the phone lies flat.
      const isDown = z < -0.75 && Math.abs(x) < 0.4 && Math.abs(y) < 0.4;
      downReadings = isDown ? downReadings + 1 : 0;
      setDown(downReadings >= 2); // about a second, so a wobble doesn't flicker the screen
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!down) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const id = setInterval(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), TICK_MS);
    return () => clearInterval(id);
  }, [down]);

  return (
    <Modal visible={down} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => undefined}>
      <StatusBar hidden />
      <View style={s.black}>
        <AppText variant="caption" center style={s.note}>{t('focus.flipDown')}</AppText>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  note: { color: '#2A2A2A' },
});
