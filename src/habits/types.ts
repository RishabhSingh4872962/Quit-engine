export type Lang = 'en' | 'hi';

export interface HabitConfig {
  id: string;
  name: Record<Lang, string>;
  tagline: Record<Lang, string>;
  accent: string;
  /** Onboarding quiz: each question has options; answers are stored for personalization. */
  quiz: { id: string; q: Record<Lang, string>; options: Record<Lang, string>[] }[];
  /** Exercises offered by the urge button. */
  urgeExercises: ('breathing' | 'timer')[];
  /** Streak milestones in days. */
  milestones: number[];
}
