import { HabitConfig } from './types';

export const nicotine: HabitConfig = {
  id: 'nicotine',
  name: { en: 'Nicotine', hi: 'निकोटीन' },
  tagline: { en: 'One craving at a time.', hi: 'एक बार में एक तलब।' },
  icon: 'flame-outline',
  accent: '#00B894',
  quiz: [
    {
      id: 'type',
      q: { en: 'What do you want to quit?', hi: 'आप क्या छोड़ना चाहते हैं?' },
      options: [
        { en: 'Cigarettes', hi: 'सिगरेट' },
        { en: 'Gutka / tobacco', hi: 'गुटखा / तंबाकू' },
        { en: 'Vape', hi: 'वेप' },
      ],
    },
  ],
  urgeExercises: ['breathing', 'timer'],
  milestones: [1, 3, 7, 14, 30, 90, 180, 365],
};
