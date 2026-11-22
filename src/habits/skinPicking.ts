import { HabitConfig } from './types';

export const skinPicking: HabitConfig = {
  id: 'skinPicking',
  name: { en: 'Skin picking', hi: 'त्वचा नोचना' },
  tagline: { en: 'Gentle hands, calmer mind.', hi: 'शांत हाथ, शांत मन।' },
  icon: 'bandage-outline',
  accent: '#D9622B',
  quiz: [
    {
      id: 'when',
      q: { en: 'When does picking happen most?', hi: 'यह सबसे ज़्यादा कब होता है?' },
      options: [
        { en: 'In front of a mirror', hi: 'शीशे के सामने' },
        { en: 'When stressed', hi: 'तनाव में' },
        { en: 'Without noticing', hi: 'बिना ध्यान दिए' },
      ],
    },
  ],
  urgeButton: { en: 'I want to pick', hi: 'नोचने का मन है' },
  urgeExercises: ['breathing', 'timer'],
  milestones: [1, 3, 7, 14, 30, 60, 90],
};
