import { HabitConfig } from './types';

export const reels: HabitConfig = {
  id: 'reels',
  name: { en: 'Reels', hi: 'रील्स' },
  tagline: { en: 'Take your time back.', hi: 'अपना समय वापस लो।' },
  icon: 'phone-portrait-outline',
  accent: '#6C5CE7',
  quiz: [
    {
      id: 'hours',
      q: { en: 'How many hours a day do you scroll?', hi: 'आप रोज़ कितने घंटे स्क्रॉल करते हैं?' },
      options: [
        { en: '1–2', hi: '1–2' },
        { en: '3–4', hi: '3–4' },
        { en: '5+', hi: '5+' },
      ],
    },
    {
      id: 'trigger',
      q: { en: 'When do you scroll most?', hi: 'आप सबसे ज़्यादा कब स्क्रॉल करते हैं?' },
      options: [
        { en: 'Bed / night', hi: 'बिस्तर / रात' },
        { en: 'Bored', hi: 'बोर होने पर' },
        { en: 'Avoiding work', hi: 'काम से बचने के लिए' },
      ],
    },
  ],
  urgeExercises: ['breathing', 'timer'],
  milestones: [1, 3, 7, 14, 30, 60, 90],
};
