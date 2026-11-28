import { Alert } from 'react-native';
import type { TFunction } from 'i18next';
import { HabitId } from '../habits/types';
import { actions } from './actions';
import { readState } from './storage';
import { streakDays } from './streak';

/** "I slipped": a gentle confirm, then a fresh streak (the days so far still count toward the total). */
export function confirmSlip(id: HabitId, t: TFunction, onDone?: () => void) {
  const days = streakDays(readState(id).streakStart, Date.now());
  Alert.alert(t('home.slipTitle'), days > 0 ? t('home.slipBodyDays', { count: days }) : t('home.slipBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('home.slipConfirm'),
      onPress: () => {
        actions.relapse(id);
        onDone?.();
      },
    },
  ]);
}
