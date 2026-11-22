import type { en } from './en';

/** Same keys as en.ts. TypeScript errors here if a key is missing. */
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : Shape<T[K]> };

export const hi: Shape<typeof en> = {
  common: {
    days_one: 'दिन',
    days_other: 'दिन',
    cancel: 'रद्द करें',
  },
  tabs: {
    home: 'होम',
    milestones: 'लक्ष्य',
    settings: 'सेटिंग्स',
  },
  onboarding: {
    chooseLanguage: 'अपनी भाषा चुनें',
    getStarted: 'शुरू करें',
    privacy: 'सब कुछ आपके फ़ोन पर ही निजी रहता है।',
    step: 'सवाल {{n}} / {{total}}',
    back: 'पीछे',
  },
  home: {
    nextMilestone_one: 'अगला लक्ष्य {{count}} दिन में',
    nextMilestone_other: 'अगला लक्ष्य {{count}} दिन में',
    allMilestones: 'सारे लक्ष्य पूरे! ऐसे ही आगे बढ़ते रहें।',
    notStarted: 'जब भी तैयार हों, शुरू करें।',
    startStreak: 'मेरी स्ट्रीक शुरू करें',
    urgeButton: 'मुझे तलब हो रही है',
    slipped: 'मुझसे चूक हो गई',
    slipTitle: 'कोई बात नहीं',
    slipBody: 'चूक होना इस सफ़र का हिस्सा है, आपकी मेहनत बेकार नहीं गई। नई स्ट्रीक अभी शुरू करें?',
    slipConfirm: 'नई शुरुआत करें',
    urgesResisted: 'बार तलब पर जीत',
    bestStreak: 'सबसे लंबी स्ट्रीक',
  },
  urge: {
    breatheIn: 'साँस अंदर',
    hold: 'रोकें',
    breatheOut: 'साँस बाहर',
    hint: 'गोले के साथ साँस लें',
    round: 'राउंड {{n}} / {{total}}',
    wellDone: 'शाबाश!',
    urgePassed: 'क्या तलब कम हुई?',
    yes: 'हाँ, कम हो गई',
    again: 'एक राउंड और',
    close: 'बंद करें',
  },
  settings: {
    title: 'सेटिंग्स',
    language: 'भाषा',
    appearance: 'थीम',
    system: 'सिस्टम',
    light: 'लाइट',
    dark: 'डार्क',
    privacy: 'आपकी प्रगति सिर्फ़ इसी फ़ोन पर सेव होती है।',
    version: 'वर्ज़न {{version}}',
  },
};
