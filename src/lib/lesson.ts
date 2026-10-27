// Shape of a saved lesson (one chapter version). Shared by server and screens.

export interface LessonExample {
  text: string;
  origin: 'book' | 'teacher';
  source_snippet?: string | null;
}
export interface LessonLesson {
  text: string;
  source_snippet?: string | null;
}
export interface LessonSection {
  heading: string;
  explanation: string;
  examples: LessonExample[];
}
export interface Lesson {
  title: string;
  main_idea: string;
  sections: LessonSection[]; // Complete Learning only
  key_lessons: LessonLesson[];
  examples: LessonExample[]; // empty in Key Ideas Only
  takeaway: string;
  quotes: { text: string; translation?: string | null }[];
  quick_check: { question: string; options: string[]; answer_index: number; simpler_explanation: string };
  reflection_questions: string[];
  coverage_note?: string | null; // e.g. "This is the free part: the first 7 pages of chapter 1."
}

/** The words the phone voice reads, in order. */
export function lessonSpeech(l: Lesson, lang: 'english' | 'hindi' | 'mix'): string[] {
  const hi = lang === 'hindi';
  const out: string[] = [];
  out.push(l.title + '.');
  out.push((hi ? 'मुख्य विचार। ' : 'Main idea. ') + l.main_idea);
  for (const s of l.sections || []) {
    out.push(s.heading + '.');
    out.push(s.explanation);
    for (const e of s.examples || []) out.push(e.text);
  }
  if (l.key_lessons?.length) {
    out.push(hi ? 'मुख्य सीख।' : 'Key lessons.');
    l.key_lessons.forEach((k, i) => out.push(`${i + 1}. ${k.text}`));
  }
  if (l.examples?.length) {
    out.push(hi ? 'उदाहरण।' : 'Examples.');
    for (const e of l.examples) out.push(e.text);
  }
  for (const q of l.quotes || []) {
    out.push(q.text);
    if (q.translation) out.push(q.translation);
  }
  out.push((hi ? 'मुख्य बात। ' : 'Key takeaway. ') + l.takeaway);
  return out;
}

/** Split text into sentences for the phone voice (keeps Hindi danda). */
export function toSentences(paragraphs: string[]): string[] {
  const out: string[] = [];
  for (const p of paragraphs) {
    const parts = p
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?।])\s+(?=["“'(\p{Lu}\p{Script=Devanagari}0-9])/u)
      .map((s) => s.trim())
      .filter(Boolean);
    out.push(...parts);
  }
  return out;
}
