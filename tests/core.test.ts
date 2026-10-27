import { describe, expect, it } from 'vitest';
import { detectChapters, freePart, stripGutenberg } from '../src/lib/chapters';
import { appearsIn, fingerprint, firstWords, questionKey, wordCount } from '../src/lib/text';
import { verifyLesson } from '../src/lib/ai';
import { lessonSpeech, toSentences, type Lesson } from '../src/lib/lesson';

const para = (n: number, w = 'word') => Array.from({ length: n }, (_, i) => `${w}${i}`).join(' ') + '.';

describe('chapter detection', () => {
  it('finds "Chapter N" headings, skips the contents page and keeps titles', () => {
    const text = [
      'CONTENTS',
      '',
      'Chapter 1',
      'First Steps',
      '',
      'Chapter 2',
      'Going Further',
      '',
      '',
      'Chapter 1',
      '',
      'First Steps',
      para(400),
      '',
      'Chapter 2',
      '',
      'Going Further',
      para(500),
    ].join('\n');
    const r = detectChapters(text);
    expect(r.chapters.map((c) => c.title)).toEqual(['First Steps', 'Going Further']);
    expect(r.chapters[0].wordCount).toBeGreaterThan(390);
  });

  it('uses roman numerals with a title line below', () => {
    const text = ['I', '', 'THE DAILY MIRACLE', '', para(500), '', 'II', '', 'THE DESIRE TO EXCEED', '', para(500)].join('\n');
    const r = detectChapters(text);
    expect(r.chapters.map((c) => c.title)).toEqual(['The Daily Miracle', 'The Desire to Exceed']);
  });

  it('labels a book without chapters honestly', () => {
    const r = detectChapters(para(900));
    expect(r.method).toBe('no-chapters');
    expect(r.chapters[0].title).toBe('Whole text');
  });

  it('strips the Project Gutenberg header and licence', () => {
    const t = 'Header stuff\n*** START OF THE PROJECT GUTENBERG EBOOK X ***\nReal text here.\n*** END OF THE PROJECT GUTENBERG EBOOK X ***\nLicence';
    expect(stripGutenberg(t).trim()).toBe('Real text here.');
  });

  it('free part is the whole chapter when short, else about 7 pages', () => {
    const short = { title: 'a', body: para(500), wordCount: 501 };
    expect(freePart(short)).toBe(short.body);
    const long = { title: 'b', body: para(5000), wordCount: 5001 };
    expect(wordCount(freePart(long))).toBeLessThanOrEqual(2000);
    const pdf = { title: 'c', body: para(6000), wordCount: 6001, startPage: 10, endPage: 30 };
    expect(wordCount(freePart(pdf, 300))).toBeLessThanOrEqual(2100);
  });
});

describe('text helpers', () => {
  it('matches snippets regardless of quote style and spacing', () => {
    expect(appearsIn('“Calm is found   within,” he said', 'He wrote: "Calm is found within," he said.')).toBe(true);
    expect(appearsIn('Calm is found outside, he said', 'He wrote: "Calm is found within," he said.')).toBe(false);
  });
  it('fingerprint ignores layout and case', () => {
    expect(fingerprint('Hello,  World!\n\nAgain')).toBe(fingerprint('hello world again'));
  });
  it('question keys ignore punctuation', () => {
    expect(questionKey('What is   this?')).toBe(questionKey('what is this'));
  });
  it('firstWords stops at a sentence end near the limit', () => {
    expect(firstWords('One two three. Four five six seven eight nine ten.', 9)).toBe('One two three. Four five six seven eight nine');
  });
});

describe('verifyLesson: nothing is attributed to the book unless it is in the book', () => {
  const source = 'Men seek retreats for themselves, houses in the country, sea-shores, and mountains; but it is in thy power whenever thou shalt choose to retire into thyself.';
  const lesson: Lesson = {
    title: 't',
    main_idea: 'm',
    sections: [],
    key_lessons: [
      { text: 'ok', source_snippet: 'houses in the country, sea-shores, and mountains' },
      { text: 'bad', source_snippet: 'this sentence is not in the book at all' },
    ],
    examples: [
      { text: 'book ok', origin: 'book', source_snippet: 'whenever thou shalt choose to retire into thyself' },
      { text: 'book invented', origin: 'book', source_snippet: 'an invented story about a merchant in Rome' },
      { text: 'teacher', origin: 'teacher', source_snippet: null },
    ],
    takeaway: 'x',
    quotes: [{ text: 'Men seek retreats for themselves', translation: null }, { text: 'Happiness is a warm puppy', translation: null }],
    quick_check: { question: 'q', options: ['a', 'b', 'c'], answer_index: 0, simpler_explanation: 's' },
    reflection_questions: ['1', '2', '3', '4'],
    coverage_note: null,
  };
  const { lesson: v, removed } = verifyLesson(lesson, source);
  it('drops invented snippets, examples and quotes', () => {
    expect(v.key_lessons[1].source_snippet).toBeNull();
    expect(v.examples.map((e) => e.text)).toEqual(['book ok', 'teacher']);
    expect(v.quotes.map((q) => q.text)).toEqual(['Men seek retreats for themselves']);
    expect(v.reflection_questions).toHaveLength(3);
    expect(removed).toBe(4);
  });
  it('speech text reads the lesson in order', () => {
    const s = toSentences(lessonSpeech(v, 'english'));
    expect(s[0]).toBe('t.');
    expect(s.some((x) => x.startsWith('Key takeaway'))).toBe(true);
  });
});
