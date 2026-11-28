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
  pledge: { en: "Today I'll be gentle with my skin.", hi: 'आज का वादा: अपनी त्वचा के साथ नरमी।' },
  triggers: [
    { id: 'mirror', label: { en: 'Near a mirror', hi: 'आईने के पास' } },
    { id: 'screen', label: { en: 'Watching a screen', hi: 'स्क्रीन देखते हुए' } },
    { id: 'bed', label: { en: 'In bed', hi: 'बिस्तर में' } },
  ],
};
