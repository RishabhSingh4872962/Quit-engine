import { HabitConfig } from './types';

export const noContact: HabitConfig = {
  id: 'noContact',
  name: { en: 'No contact', hi: 'नो कॉन्टैक्ट' },
  tagline: { en: 'Give your heart room to heal.', hi: 'दिल को सँभलने का समय दें।' },
  icon: 'heart-half-outline',
  accent: '#E05A8A',
  quiz: [
    {
      id: 'since',
      q: { en: 'How long ago did it end?', hi: 'रिश्ता कितने समय पहले ख़त्म हुआ?' },
      options: [
        { en: 'Less than a month', hi: 'एक महीने से कम' },
        { en: '1–6 months', hi: '1–6 महीने' },
        { en: 'More than 6 months', hi: '6 महीने से ज़्यादा' },
      ],
    },
    {
      id: 'hardest',
      q: { en: 'When is it hardest?', hi: 'सबसे मुश्किल कब होता है?' },
      options: [
        { en: 'Late at night', hi: 'देर रात' },
        { en: 'When I see their posts', hi: 'जब उनकी पोस्ट दिखती है' },
        { en: 'When I feel lonely', hi: 'जब अकेलापन लगता है' },
      ],
    },
  ],
  urgeButton: { en: 'I want to text them', hi: 'उन्हें मैसेज करने का मन है' },
  urgeExercises: ['breathing', 'timer'],
  milestones: [1, 3, 7, 14, 30, 60, 90],
  pledge: { en: "Today I won't reach out to them.", hi: 'आज का वादा: उनसे कोई संपर्क नहीं।' },
  triggers: [
    { id: 'photo', label: { en: 'Saw a photo or their profile', hi: 'फ़ोटो या उनकी प्रोफ़ाइल दिखी' } },
    { id: 'memory', label: { en: 'A song or memory', hi: 'कोई गाना या याद' } },
    { id: 'night', label: { en: 'Alone at night', hi: 'रात में अकेले' } },
  ],
};
