import { HabitConfig } from './types';

export const nailBiting: HabitConfig = {
  id: 'nailBiting',
  name: { en: 'Nail biting', hi: 'नाखून चबाना' },
  tagline: { en: 'Notice it, pause, let it pass.', hi: 'ध्यान दें, रुकें, जाने दें।' },
  icon: 'hand-left-outline',
  accent: '#0984E3',
  quiz: [
    {
      id: 'when',
      q: { en: 'When do you bite your nails most?', hi: 'आप सबसे ज़्यादा कब नाखून चबाते हैं?' },
      options: [
        { en: 'When stressed or anxious', hi: 'तनाव या घबराहट में' },
        { en: 'When bored', hi: 'बोर होने पर' },
        { en: 'Without noticing', hi: 'बिना ध्यान दिए' },
      ],
    },
  ],
  urgeButton: { en: 'I want to bite', hi: 'नाखून चबाने का मन है' },
  urgeExercises: ['breathing', 'timer'],
  milestones: [1, 3, 7, 14, 30, 60, 90],
  pledge: { en: "Today I'll keep my hands busy and kind.", hi: 'आज का वादा: हाथ व्यस्त, नाखून सुरक्षित।' },
  triggers: [
    { id: 'screen', label: { en: 'Watching a screen', hi: 'स्क्रीन देखते हुए' } },
    { id: 'class', label: { en: 'In class or a meeting', hi: 'क्लास या मीटिंग में' } },
    { id: 'thinking', label: { en: 'Deep in thought', hi: 'गहरी सोच में' } },
  ],
};
