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
  pledge: { en: "Today I'll keep reels under my limit.", hi: 'आज का वादा: रील्स मेरी लिमिट के अंदर।' },
  triggers: [
    { id: 'waiting', label: { en: 'Waiting or travelling', hi: 'इंतज़ार या सफ़र में' } },
    { id: 'bed', label: { en: 'In bed before sleep', hi: 'सोने से पहले बिस्तर में' } },
    { id: 'study', label: { en: 'Avoiding study or work', hi: 'पढ़ाई या काम से बचना' } },
    { id: 'notification', label: { en: 'A notification pulled me in', hi: 'नोटिफ़िकेशन ने खींच लिया' } },
  ],
  reelBaseline: { quizId: 'hours', minutes: [90, 210, 300] }, // answers 1–2 h, 3–4 h, 5+ h
  reelApps: [
    { id: 'com.instagram.android', name: 'Instagram Reels' },
    { id: 'com.google.android.youtube', name: 'YouTube Shorts' },
  ],
  // "Pause before opening": apps people open on autopilot (social, short video, games, streaming).
  gateApps: [
    { id: 'com.instagram.android', name: 'Instagram' },
    { id: 'com.google.android.youtube', name: 'YouTube' },
    { id: 'com.facebook.katana', name: 'Facebook' },
    { id: 'com.snapchat.android', name: 'Snapchat' },
    { id: 'com.twitter.android', name: 'X' },
    { id: 'in.mohalla.sharechat', name: 'ShareChat' },
    { id: 'in.mohalla.video', name: 'Moj' },
    { id: 'com.eterno.shortvideos', name: 'Josh' },
    { id: 'com.instagram.lite', name: 'Instagram Lite' },
    { id: 'com.facebook.lite', name: 'Facebook Lite' },
    { id: 'com.reddit.frontpage', name: 'Reddit' },
    { id: 'com.pinterest', name: 'Pinterest' },
    { id: 'com.pubg.imobile', name: 'BGMI' },
    { id: 'com.dts.freefiremax', name: 'Free Fire MAX' },
    { id: 'com.dts.freefireth', name: 'Free Fire' },
    { id: 'com.netflix.mediaclient', name: 'Netflix' },
    { id: 'in.startv.hotstar', name: 'JioHotstar' },
    { id: 'com.mxtech.videoplayer.ad', name: 'MX Player' },
  ],
  // Short-video apps popular in India. Users can switch any of them off (e.g. YouTube for study).
  screenTime: {
    apps: [
      { id: 'com.instagram.android', name: 'Instagram' },
      { id: 'com.google.android.youtube', name: 'YouTube' },
      { id: 'com.facebook.katana', name: 'Facebook' },
      { id: 'com.snapchat.android', name: 'Snapchat' },
      { id: 'in.mohalla.video', name: 'Moj' },
      { id: 'com.eterno.shortvideos', name: 'Josh' },
      { id: 'in.mohalla.sharechat', name: 'ShareChat' },
      { id: 'com.instagram.lite', name: 'Instagram Lite' },
      { id: 'com.facebook.lite', name: 'Facebook Lite' },
    ],
  },
};
