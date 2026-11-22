/**
 * Shared UI copy. Habit-specific text (names, taglines, quiz) lives in src/habits/.
 * Tone: gentle and non-shaming; no medical or treatment claims.
 */
export const en = {
  common: {
    days_one: 'day',
    days_other: 'days',
    cancel: 'Cancel',
  },
  tabs: {
    home: 'Home',
    milestones: 'Milestones',
    settings: 'Settings',
  },
  onboarding: {
    chooseLanguage: 'Choose your language',
    getStarted: 'Get started',
    privacy: 'Everything stays private on your phone.',
    step: 'Question {{n}} of {{total}}',
    back: 'Back',
  },
  home: {
    nextMilestone_one: 'Next milestone in {{count}} day',
    nextMilestone_other: 'Next milestone in {{count}} days',
    allMilestones: 'Every milestone reached. Keep going!',
    notStarted: 'Start whenever you feel ready.',
    startStreak: 'Start my streak',
    urgeButton: "I'm having an urge",
    slipped: 'I slipped',
    slipTitle: "That's okay",
    slipBody: 'Slips are part of quitting, and your progress still counts. Start a fresh streak now?',
    slipConfirm: 'Start fresh',
    urgesResisted: 'urges resisted',
    bestStreak: 'best streak',
  },
  urge: {
    breatheIn: 'Breathe in',
    hold: 'Hold',
    breatheOut: 'Breathe out',
    hint: 'Breathe with the circle',
    round: 'Round {{n}} of {{total}}',
    wellDone: 'Well done!',
    urgePassed: 'Did the urge pass?',
    yes: 'Yes, it passed',
    again: 'One more round',
    close: 'Close',
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    appearance: 'Appearance',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    privacy: 'Your progress is stored only on this phone.',
    version: 'Version {{version}}',
  },
} as const;
