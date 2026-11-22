import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

export type Lang = 'en' | 'hi';

export type HabitId = 'reels' | 'nicotine' | 'noContact' | 'nailBiting' | 'skinPicking';

export interface HabitConfig {
  id: HabitId;
  /** Short name, shown in the habit switcher and as the Home title. */
  name: Record<Lang, string>;
  tagline: Record<Lang, string>;
  icon: ComponentProps<typeof Ionicons>['name'];
  /** Tints the whole UI while this habit is selected. */
  accent: string;
  /** Onboarding quiz: each question has options; answers are stored for personalization. */
  quiz: { id: string; q: Record<Lang, string>; options: Record<Lang, string>[] }[];
  /** Replaces the generic "I'm having an urge" button, e.g. "I want to text them". */
  urgeButton?: Record<Lang, string>;
  /** Exercises offered by the urge button. */
  urgeExercises: ('breathing' | 'timer')[];
  /** Streak milestones in days. */
  milestones: number[];
  /**
   * Android only: shows daily time spent in these apps (package id + display name), read
   * on the phone from Usage access. Never uploaded.
   */
  screenTime?: { apps: { id: string; name: string }[] };
  /**
   * Android only: apps whose reels/shorts are counted (package id + display name). Detection
   * rules live in the native reel-guard module and can be updated from Remote Config.
   */
  reelApps?: { id: string; name: string }[];
  /**
   * For "time won back": which quiz question gives the old daily scrolling time, and the
   * minutes each answer stands for (e.g. "3–4 hours" -> 210).
   */
  reelBaseline?: { quizId: string; minutes: number[] };
}
