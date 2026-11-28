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
  pledge: { en: "Today I won't smoke or chew tobacco.", hi: 'आज का वादा: न सिगरेट, न तंबाकू।' },
  triggers: [
    { id: 'meal', label: { en: 'After a meal', hi: 'खाने के बाद' } },
    { id: 'chai', label: { en: 'With chai or coffee', hi: 'चाय या कॉफ़ी के साथ' } },
    { id: 'friends', label: { en: 'Friends were smoking', hi: 'दोस्त पी रहे थे' } },
    { id: 'work', label: { en: 'Work or study break', hi: 'काम या पढ़ाई के ब्रेक में' } },
  ],
};
