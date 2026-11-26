// A quick look at a chapter's text, to explain why a lesson for it may fail.
export interface ChapterCheck {
  words: number;
  notes: string[]; // plain-language findings; empty when the text looks normal
}

export const SHORT_WORDS = 120;
export const LONG_WORDS = 12000;

export function checkChapter(body: string): ChapterCheck {
  const text = body || '';
  const words = text.split(/\s+/).filter(Boolean);
  const notes: string[] = [];
  const n = words.length;
  if (n === 0) return { words: 0, notes: ['This chapter has no text at all, so there is nothing to teach. The book may need to be uploaded again.'] };
  if (n < SHORT_WORDS) notes.push(`Very short (${n} words). It may be only a heading, a contents page or a wrong split, so there is little to teach.`);
  if (n > LONG_WORDS) notes.push(`Very long (${n.toLocaleString('en-IN')} words). A full lesson, especially in Hindi or Mix, can be more than the AI writes in one go.`);

  const nonSpace = (text.match(/\S/gu) || []).length;
  const letters = (text.match(/\p{L}|\p{M}/gu) || []).length;
  const broken = (text.match(/�/g) || []).length;
  const oneLetter = words.filter((w) => /^\p{L}$/u.test(w)).length;
  if (broken > 5 || (nonSpace > 200 && letters / nonSpace < 0.7) || (n > 200 && oneLetter / n > 0.2)) {
    notes.push('Many odd characters or broken words. The text probably came from a poor scan; a cleaner copy of the book would help.');
  }

  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 3);
  if (lines.length > 30) {
    const seen = new Map<string, number>();
    for (const l of lines) seen.set(l, (seen.get(l) || 0) + 1);
    const repeated = [...seen.values()].filter((c) => c > 2).reduce((a, c) => a + c, 0);
    if (repeated / lines.length > 0.2) notes.push('Many repeated lines (probably page headers or footers left in the text).');
  }
  return { words: n, notes };
}
