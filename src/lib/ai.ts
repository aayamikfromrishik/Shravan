// Everything SHRAVAN asks Claude to do. Server only.
// Rule: Claude only ever sees the real text of the chapter it is working on,
// and every quotation / "from the book" link is checked word for word afterwards.

import Anthropic from '@anthropic-ai/sdk';
import { MODEL, type Lang, type Level, type Mode } from './config';
import { appearsIn } from './text';
import type { Lesson } from './lesson';

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
}

async function callJson<T>(opts: {
  system: string;
  cachedContext?: string; // the chapter text: cached so other modes/levels reuse it
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  effort?: 'low' | 'medium' | 'high';
}): Promise<{ data: T; usage: Usage }> {
  const content: Anthropic.ContentBlockParam[] = [];
  if (opts.cachedContext) {
    content.push({ type: 'text', text: opts.cachedContext, cache_control: { type: 'ephemeral' } });
  }
  content.push({ type: 'text', text: opts.prompt });
  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: [{ role: 'user', content }],
    output_config: { effort: opts.effort ?? 'medium', format: { type: 'json_schema', schema: opts.schema } },
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const data = JSON.parse(text) as T;
  return {
    data,
    usage: {
      input_tokens: res.usage.input_tokens ?? 0,
      output_tokens: res.usage.output_tokens ?? 0,
      cache_read_tokens: res.usage.cache_read_input_tokens ?? 0,
    },
  };
}

// ---------- shared instructions ----------
const RULES = `You are SHRAVAN, a patient teacher who helps people understand and apply books.
Strict rules:
- Use ONLY the chapter text you are given. Never add claims, stories, studies, numbers or quotations that are not in it.
- Anything you add to help understanding (an everyday example, an analogy) must be marked as a teacher's example, never as the author's.
- A "source_snippet" must be copied exactly, word for word, from the chapter text (12 to 40 words). If you cannot, leave it empty.
- Quotations must be copied exactly from the chapter text. Keep them short (under 40 words). Use at most three.
- If the text is partial, say only what this part covers. Do not guess what comes later.
- Be warm, clear and practical. No flattery, no filler.`;

function levelRule(level: Level) {
  return {
    basic: 'English level: Basic. Short sentences (under 15 words), everyday words, explain any difficult word in brackets.',
    normal: 'English level: Normal. Clear, natural sentences for a general adult reader.',
    advanced: 'English level: Advanced. Precise vocabulary, fuller reasoning, connect ideas where the text supports it.',
  }[level];
}

function langRule(lang: Lang) {
  return {
    english: 'Write in English.',
    hindi: 'Write in simple, natural Hindi (Devanagari script). Quotations stay in the book\'s original language; put a Hindi translation in "translation".',
    mix: 'Write in natural Hinglish: mostly Hindi in Devanagari script, keeping common English words as English (in Latin script) the way people speak in India. Quotations stay in the book\'s language with a Hindi translation in "translation".',
  }[lang];
}

function modeRule(mode: Mode) {
  return {
    key: 'Mode: Key Ideas Only. Give the main idea, 3 to 5 key lessons and the takeaway. Leave "examples" and "sections" empty.',
    examples: 'Mode: Key Ideas + Essential Examples. Give the main idea, 3 to 5 key lessons, 2 to 4 examples that make the lessons stick (prefer examples from the book), and the takeaway. Leave "sections" empty.',
    complete: 'Mode: Complete Learning Experience. Walk through the chapter section by section in "sections" (3 to 8 sections, following the chapter\'s own order), each with a clear explanation and its examples. Then give 3 to 5 key lessons and the takeaway. Leave the top-level "examples" empty.',
  }[mode];
}

function subjectRule(subject: string | null) {
  if (subject === 'spiritual')
    return 'This is a sacred or spiritual text. Be respectful and neutral: explain what the text says and how it is traditionally understood; where traditions differ, say so. Never rank one faith above another. Reflection questions should invite personal reflection, not judgement.';
  return '';
}

const exampleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'origin', 'source_snippet'],
  properties: {
    text: { type: 'string' },
    origin: { type: 'string', enum: ['book', 'teacher'] },
    source_snippet: { type: ['string', 'null'] },
  },
};

const lessonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'main_idea', 'sections', 'key_lessons', 'examples', 'takeaway', 'quotes', 'quick_check', 'reflection_questions', 'coverage_note'],
  properties: {
    title: { type: 'string' },
    main_idea: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'explanation', 'examples'],
        properties: { heading: { type: 'string' }, explanation: { type: 'string' }, examples: { type: 'array', items: exampleSchema } },
      },
    },
    key_lessons: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'source_snippet'],
        properties: { text: { type: 'string' }, source_snippet: { type: ['string', 'null'] } },
      },
    },
    examples: { type: 'array', items: exampleSchema },
    takeaway: { type: 'string' },
    quotes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'translation'],
        properties: { text: { type: 'string' }, translation: { type: ['string', 'null'] } },
      },
    },
    quick_check: {
      type: 'object',
      additionalProperties: false,
      required: ['question', 'options', 'answer_index', 'simpler_explanation'],
      properties: {
        question: { type: 'string' },
        options: { type: 'array', items: { type: 'string' } },
        answer_index: { type: 'integer' },
        simpler_explanation: { type: 'string' },
      },
    },
    reflection_questions: { type: 'array', items: { type: 'string' } },
    coverage_note: { type: ['string', 'null'] },
  },
};

/** Remove anything that claims to come from the book but cannot be found in it. */
export function verifyLesson(lesson: Lesson, sourceText: string): { lesson: Lesson; removed: number } {
  let removed = 0;
  const checkSnippet = <T extends { source_snippet?: string | null }>(x: T): T => {
    if (x.source_snippet && !appearsIn(x.source_snippet, sourceText)) {
      removed++;
      return { ...x, source_snippet: null };
    }
    return x;
  };
  const checkExamples = (list: Lesson['examples']) =>
    (list || [])
      .map(checkSnippet)
      .filter((e) => {
        // A "from the book" example must be traceable to the text.
        if (e.origin === 'book' && !e.source_snippet) {
          removed++;
          return false;
        }
        return true;
      });
  const quotes = (lesson.quotes || []).filter((q) => {
    const ok = appearsIn(q.text, sourceText);
    if (!ok) removed++;
    return ok;
  });
  const checked: Lesson = {
    ...lesson,
    key_lessons: (lesson.key_lessons || []).map(checkSnippet),
    examples: checkExamples(lesson.examples),
    sections: (lesson.sections || []).map((s) => ({ ...s, examples: checkExamples(s.examples) })),
    quotes,
    reflection_questions: (lesson.reflection_questions || []).slice(0, 3),
  };
  return { removed, lesson: checked };
}

export async function generateLesson(args: {
  bookTitle: string;
  author: string | null;
  chapterTitle: string;
  chapterText: string;
  isPartial: boolean;
  mode: Mode;
  level: Level;
  lang: Lang;
  subject: string | null;
}): Promise<{ lesson: Lesson; removed: number; usage: Usage }> {
  const context = `BOOK: ${args.bookTitle}${args.author ? ` by ${args.author}` : ''}
CHAPTER: ${args.chapterTitle}
${args.isPartial ? 'NOTE: this is only the free part of the chapter (the first pages). Teach only what it contains.\n' : ''}
--- CHAPTER TEXT START ---
${args.chapterText}
--- CHAPTER TEXT END ---`;
  const prompt = [
    modeRule(args.mode),
    levelRule(args.level),
    langRule(args.lang),
    subjectRule(args.subject),
    'Also write: one quick_check multiple-choice question (3 options) that tests whether the main idea landed, plus a simpler re-explanation for anyone who misses it; and exactly 3 reflection_questions that ask about the learner\'s own life (not a quiz) and connect to this chapter.',
    'coverage_note: one short sentence only if the text is partial or unclear, otherwise null.',
  ]
    .filter(Boolean)
    .join('\n');
  const maxTokens = args.mode === 'complete' ? 9000 : args.mode === 'examples' ? 5000 : 3500;
  const { data, usage } = await callJson<Lesson>({ system: RULES, cachedContext: context, prompt, schema: lessonSchema, maxTokens });
  const { lesson, removed } = verifyLesson(data, args.chapterText);
  return { lesson, removed, usage };
}

// ---------- personal actions ----------
export interface ActionItem {
  text: string;
  source: 'book' | 'shravan';
  because: string | null;
}

export async function generateActions(args: {
  bookTitle: string;
  chapterTitle: string;
  lesson: Lesson;
  reflections: { question: string; answer: string | null; skipped: boolean }[];
  lang: Lang;
  subject: string | null;
}): Promise<{ actions: ActionItem[]; usage: Usage }> {
  const answered = args.reflections.filter((r) => r.answer && !r.skipped);
  const spiritual = args.subject === 'spiritual';
  const prompt = `Book: ${args.bookTitle}. Chapter: ${args.chapterTitle}.
Lesson summary (already checked against the book):
${JSON.stringify({ main_idea: args.lesson.main_idea, key_lessons: args.lesson.key_lessons.map((k) => k.text), takeaway: args.lesson.takeaway })}

The learner's private reflections:
${answered.length ? answered.map((r) => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n') : '(The learner skipped the questions.)'}

Write 1 to 3 ${spiritual ? 'gentle intentions for the day ("What I\'ll carry into my day")' : 'small, measurable actions with a clear timeframe (for example "this week", "for the next 5 evenings")'}.
- Mark source "book" only when the action is the author's own advice in this lesson; otherwise "shravan".
- Connect at least one action to what the learner wrote, and say why in "because" (one short sentence quoting their situation in your words). If they skipped, keep actions general and set "because" to null.
- ${langRule(args.lang)}`;
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['actions'],
    properties: {
      actions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'source', 'because'],
          properties: { text: { type: 'string' }, source: { type: 'string', enum: ['book', 'shravan'] }, because: { type: ['string', 'null'] } },
        },
      },
    },
  };
  const { data, usage } = await callJson<{ actions: ActionItem[] }>({ system: RULES, prompt, schema, maxTokens: 1200, effort: 'low' });
  return { actions: data.actions.slice(0, 3), usage };
}

// ---------- ask about this chapter ----------
export async function answerQuestion(args: {
  bookTitle: string;
  chapterTitle: string;
  chapterText: string;
  question: string;
  level: Level;
  lang: Lang;
}): Promise<{ answer: string; found: boolean; usage: Usage }> {
  const context = `BOOK: ${args.bookTitle}\nCHAPTER: ${args.chapterTitle}\n--- CHAPTER TEXT START ---\n${args.chapterText}\n--- CHAPTER TEXT END ---`;
  const prompt = `The learner asks: "${args.question}"
Answer only from this chapter. If the chapter does not answer it, set found_in_chapter to false and say so kindly in one or two sentences, without guessing.
Keep the answer under 120 words. ${levelRule(args.level)} ${langRule(args.lang)}`;
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['answer', 'found_in_chapter'],
    properties: { answer: { type: 'string' }, found_in_chapter: { type: 'boolean' } },
  };
  const { data, usage } = await callJson<{ answer: string; found_in_chapter: boolean }>({ system: RULES, cachedContext: context, prompt, schema, maxTokens: 800, effort: 'low' });
  return { answer: data.answer, found: data.found_in_chapter, usage };
}

// ---------- read-along ----------
export async function readAlongReply(args: {
  bookTitle: string;
  chapterLabel: string;
  turns: { role: 'learner' | 'shravan'; text: string }[];
  lang: Lang;
  followUpsLeft: number;
}): Promise<{ reply: string; usage: Usage }> {
  const system = `You are SHRAVAN in Read-along mode. The learner is reading "${args.bookTitle}" on paper and tells you what they understood.
You do NOT have the book's text. Never state what the book says, never quote it, never add facts about it.
Work only with the learner's own notes: reflect them back clearly, ask one helpful follow-up question at a time about their understanding or their own life, and help them put ideas in their own words.
Keep replies under 70 words. ${langRule(args.lang)}`;
  const prompt = `Chapter: ${args.chapterLabel}. Follow-ups left after this one: ${args.followUpsLeft}.
Conversation so far:
${args.turns.map((t) => `${t.role === 'learner' ? 'Learner' : 'SHRAVAN'}: ${t.text}`).join('\n')}
${args.followUpsLeft <= 0 ? 'This is the last reply: summarise their notes in two sentences and suggest moving to Reflect.' : ''}`;
  const schema = { type: 'object', additionalProperties: false, required: ['reply'], properties: { reply: { type: 'string' } } };
  const { data, usage } = await callJson<{ reply: string }>({ system, prompt, schema, maxTokens: 500, effort: 'low' });
  return { reply: data.reply, usage };
}

// ---------- end-of-book plan ----------
export interface BookPlan {
  book_ideas: string[];
  suggestions: string[];
  revisit: string[];
}
export async function generateBookPlan(args: {
  bookTitle: string;
  actions: { text: string; source: 'book' | 'shravan'; done: boolean; chapter: string }[];
  revisit: string[];
  lang: Lang;
}): Promise<{ plan: BookPlan; usage: Usage }> {
  const prompt = `Book: ${args.bookTitle}.
The learner's chapter actions (source "book" = the author's advice, "shravan" = added suggestions):
${JSON.stringify(args.actions)}
Ideas the learner skipped or missed: ${JSON.stringify(args.revisit)}

Combine these into one concise end-of-book plan:
- book_ideas: up to 5 actions taken from the "book" items (merge duplicates; keep the author's meaning).
- suggestions: up to 4 actions from the "shravan" items.
- revisit: up to 4 short lines naming what to revisit.
Do not invent new claims about the book. ${langRule(args.lang)}`;
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['book_ideas', 'suggestions', 'revisit'],
    properties: {
      book_ideas: { type: 'array', items: { type: 'string' } },
      suggestions: { type: 'array', items: { type: 'string' } },
      revisit: { type: 'array', items: { type: 'string' } },
    },
  };
  const { data, usage } = await callJson<BookPlan>({ system: RULES, prompt, schema, maxTokens: 1500, effort: 'low' });
  return { plan: data, usage };
}
