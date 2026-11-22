import { HabitConfig, HabitId } from './types';
import { reels } from './reels';
import { nicotine } from './nicotine';
import { noContact } from './noContact';
import { nailBiting } from './nailBiting';
import { skinPicking } from './skinPicking';

/** Every habit the app offers. To add one: create its config file, add its id to HabitId, list it here. */
export const HABIT_LIST: HabitConfig[] = [reels, nicotine, noContact, nailBiting, skinPicking];

export const HABITS = Object.fromEntries(HABIT_LIST.map((h) => [h.id, h])) as Record<HabitId, HabitConfig>;

export const isHabitId = (v: unknown): v is HabitId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(HABITS, v);

/** App colour before any habit is picked (onboarding) and for app-level things like notifications. */
export const BRAND_ACCENT = '#6C5CE7';
