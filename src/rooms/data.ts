/**
 * Fixed lists for rooms. Avatars and focus tags are ids, not free text, so the only text people can
 * type is a nickname or a custom room name (both filtered here and in database.rules.json).
 * Keep the ids in sync with the rules (avatar a01–a24, tags below).
 */

export const AVATARS = [
  '🦊', '🐼', '🐨', '🦁', '🐯', '🐸', '🐵', '🦉', '🐧', '🐢', '🐙', '🦋',
  '🐝', '🌻', '🌵', '🍀', '🌙', '⭐', '🔥', '🌊', '🎧', '📚', '☕', '🚀',
] as const;

export const avatarIds = AVATARS.map((_, i) => `a${String(i + 1).padStart(2, '0')}`);
export const avatarEmoji = (id: string | undefined) => AVATARS[Number(id?.slice(1)) - 1] ?? '🙂';

export const FOCUS_TAGS = ['jee', 'neet', 'upsc', 'boards', 'college', 'coding', 'work', 'reading', 'other'] as const;
export type FocusTag = (typeof FOCUS_TAGS)[number];
export const isFocusTag = (v: unknown): v is FocusTag => FOCUS_TAGS.includes(v as FocusTag);

/**
 * Study subjects: ids only (labels in i18n `focus.subjectNames`), so per-subject leaderboards in
 * rooms carry no free text. Keep in sync with the `sboard` rules in database.rules.json.
 */
export const SUBJECTS = [
  'physics', 'chemistry', 'maths', 'biology', 'science', 'english', 'hindi', 'social', 'history', 'geography',
  'polity', 'economy', 'current', 'reasoning', 'accounts', 'coding', 'revision', 'mock', 'other',
] as const;
export type Subject = (typeof SUBJECTS)[number];
export const isSubject = (v: unknown): v is Subject => SUBJECTS.includes(v as Subject);

/** Offered first until the user picks their own subjects. */
export const SUGGESTED_SUBJECTS: Record<FocusTag | 'none', Subject[]> = {
  jee: ['physics', 'chemistry', 'maths', 'mock'],
  neet: ['physics', 'chemistry', 'biology', 'mock'],
  upsc: ['polity', 'history', 'geography', 'economy', 'current'],
  boards: ['maths', 'science', 'english', 'social'],
  college: ['maths', 'english', 'revision', 'other'],
  coding: ['coding', 'maths', 'other'],
  work: ['other'],
  reading: ['english', 'other'],
  other: ['revision', 'other'],
  none: ['maths', 'science', 'english', 'revision', 'other'],
};

export const ROOM_KINDS = ['study', 'silent', 'people', 'custom'] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

/** Shared timers for custom rooms: focus/break minutes (break 0 = everyone keeps their own timer). */
export const ROOM_TIMERS = [
  { focus: 25, brk: 5 },
  { focus: 50, brk: 10 },
  { focus: 25, brk: 0 },
] as const;

export const NICK_RE = /^[A-Za-z0-9_]{3,20}$/;

// Words that may not appear in nicknames or room names (English + Hinglish). A first filter only:
// reports and bans handle the rest. Short words are matched as whole words to avoid false hits.
// Substrings only where no common name or word contains them ("shit" is inside Kshitij, "randi" inside
// Randive, "rape" inside grape, "chod" inside "phone chodo"), so those are whole-word matches.
const BLOCKED = [
  'fuck', 'bitch', 'cunt', 'pussy', 'whore', 'slut', 'nigg', 'porn', 'nude', 'sexy',
  'chutiya', 'chutia', 'chotiya', 'madarchod', 'maderchod', 'behenchod', 'bhenchod', 'bhosdi', 'bsdk', 'gandu',
  'lauda', 'lavda', 'jhatu', 'chodu', 'harami',
];
const BLOCKED_WORDS = ['shit', 'dick', 'rape', 'randi', 'lund', 'sex', 'bc', 'mc', 'bkl', 'mkc', 'tmkc', 'gand', 'kamina'];

/** True if the text contains a blocked word (also catches 0→o, 1→i, 3→e, 4→a, 5→s, @→a swaps). */
export function isBlockedText(text: string): boolean {
  const plain = text
    .toLowerCase()
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/@/g, 'a');
  const squashed = plain.replace(/[^a-z]/g, '');
  if (BLOCKED.some((w) => squashed.includes(w))) return true;
  const words = plain.split(/[^a-z]+/).filter(Boolean);
  return words.some((w) => BLOCKED_WORDS.includes(w));
}

/** Links and handles turn rooms into spam; room names may not contain them. */
export const hasLink = (text: string) => /https?:|www\.|\.(com|in|net|org|xyz|link|ly)\b|@\w|t\.me/i.test(text);
