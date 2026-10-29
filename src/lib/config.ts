// Central settings. Numbers marked "to test" are beta values from the spec.

export const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';

export const LIMITS = {
  freePreviewBooks: 5,          // lifetime free previews per learner
  freePartPages: 7,             // chapter 1, at most 7 pages
  freePartWordsNoPages: 2000,   // EPUB / plain text: 7 pages ~ 2,000 words
  askPerChapter: 5,             // "Ask about this chapter" (subscribers)
  readAlongFollowUps: 5,        // Read-along follow-ups per chapter
  maxUploadMB: 30,              // to test
  maxPages: 500,                // to test
  maxWords: 200_000,            // to test
  minWordsPerPageForText: 25,   // below this a PDF is treated as a scan
};

export const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === 'true';

export const SUBJECTS = [
  { id: 'habits', name: 'Habits & Time' },
  { id: 'mind', name: 'Mind & Calm' },
  { id: 'work', name: 'Work, Money & Success' },
  { id: 'communication', name: 'Communication & Relationships' },
  { id: 'business', name: 'Business & Creative Practice' },
  { id: 'spiritual', name: 'Spiritual library' },
  { id: 'classics', name: 'Classics' },
  { id: 'lives', name: 'Lives & Leaders' },
  { id: 'indian', name: 'Indian Wisdom' },
  { id: 'history', name: 'History & Big Ideas' },
] as const;

export type SubjectId = (typeof SUBJECTS)[number]['id'];
export type Mode = 'key' | 'examples' | 'complete';
export type Level = 'basic' | 'normal' | 'advanced';
export type Lang = 'english' | 'hindi' | 'mix';
export type Part = 'free' | 'full';

export const MODE_LABEL: Record<Mode, string> = {
  key: 'Key Ideas Only',
  examples: 'Key Ideas + Essential Examples',
  complete: 'Complete Learning Experience',
};
export const LEVEL_LABEL: Record<Level, string> = { basic: 'Basic', normal: 'Normal', advanced: 'Advanced' };
export const LANG_LABEL: Record<Lang, string> = { english: 'English', hindi: 'हिन्दी', mix: 'Mix' };

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
