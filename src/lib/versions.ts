// Get a saved lesson, or write it once (the first learner to ask pays the AI cost; everyone after reuses it).
import { db, logUsage, type BookRow } from './server';
import { generateLesson, LessonError } from './ai';
import { levelFor, type Lang, type Level, type Mode, type Part } from './config';
import type { Lesson } from './lesson';

export interface VersionResult {
  status: 'ready' | 'generating' | 'failed';
  lesson?: Lesson;
  versionId?: string;
  removedQuotes?: number;
  isSample?: boolean;
  reason?: string; // plain-language reason when it failed
}

/** Turn a failure into "code: detail" (saved) — see explainLessonError for the plain words. */
function errorCode(e: unknown): string {
  if (e instanceof LessonError) return `${e.code}: ${e.message}`;
  const err = e as { status?: number; message?: string };
  const msg = String(err?.message || e).slice(0, 200);
  if (/credit balance/i.test(msg)) return `credit: ${msg}`;
  if (err?.status === 401 || err?.status === 403) return `key: ${msg}`;
  if (/prompt is too long|context/i.test(msg)) return `input_too_long: ${msg}`;
  if (err?.status === 429 || err?.status === 529 || (err?.status ?? 0) >= 500 || /overloaded|rate limit|timed? ?out|ECONNRESET|fetch failed/i.test(msg)) return `ai_busy: ${msg}`;
  return `other: ${msg}`;
}

export function explainLessonError(error: string | null | undefined): string {
  const code = (error || '').split(':')[0];
  return (
    {
      too_long: 'The lesson came out longer than the AI can write in one go. A retry writes a shorter version automatically.',
      stopped: 'It stopped part-way, most likely because it took more than 5 minutes. A retry writes a shorter version automatically.',
      refused: 'The AI declined to write about this text.',
      bad_reply: "The AI's reply came back broken. A retry usually works.",
      ai_busy: 'The AI service was busy or the connection dropped. Retry in a few minutes.',
      credit: 'The Anthropic credit has run out. Top it up, then retry.',
      key: 'There is a problem with the Anthropic key saved in Vercel.',
      input_too_long: 'The chapter is too long for the AI to read in one go.',
    }[code] || (error ? `Something went wrong: ${error.replace(/^other: /, '')}` : 'It failed without a saved reason (from before reasons were recorded). Retry to see the reason.')
  );
}
const STALE_MS = 4 * 60 * 1000;

export async function getOrCreateVersion(args: {
  book: BookRow;
  chapter: { id: string; idx: number; title: string; body: string; free_text: string | null };
  part: Part;
  mode: Mode;
  level: Level;
  lang: Lang;
}): Promise<VersionResult> {
  args = { ...args, level: levelFor(args.lang, args.level) };
  const key = { chapter_id: args.chapter.id, part: args.part, mode: args.mode, level: args.level, lang: args.lang };
  const { data: found } = await db().from('chapter_versions').select('*').match(key).maybeSingle();
  if (found?.status === 'ready') {
    return { status: 'ready', lesson: found.content as Lesson, versionId: found.id, removedQuotes: found.removed_quotes, isSample: found.is_sample };
  }
  if (found?.status === 'generating' && Date.now() - new Date(found.created_at).getTime() < STALE_MS) {
    return { status: 'generating', versionId: found.id };
  }
  // A last try that was too long, or that died part-way (a stale "generating"), gets a shorter lesson this time.
  const lastError = String(found?.error || '');
  const compact = found?.status === 'generating' || /^(too_long|stopped)/.test(lastError);

  // Claim the job (a unique key makes sure only one request writes it).
  let versionId = found?.id as string | undefined;
  if (found) {
    await db().from('chapter_versions').update({ status: 'generating', created_at: new Date().toISOString() }).eq('id', found.id);
  } else {
    const { data: claimed, error } = await db().from('chapter_versions').insert({ ...key, status: 'generating' }).select('id').single();
    if (error) return { status: 'generating' }; // someone else just started it
    versionId = claimed.id;
  }

  const text = args.part === 'free' && args.chapter.free_text ? args.chapter.free_text : args.chapter.body;
  try {
    const { lesson, removed, usage } = await generateLesson({
      bookTitle: args.book.title,
      author: args.book.author,
      chapterTitle: args.chapter.title,
      chapterText: text,
      isPartial: args.part === 'free' && !!args.chapter.free_text && args.chapter.free_text.length < args.chapter.body.length,
      mode: args.mode,
      level: args.level,
      lang: args.lang,
      subject: args.book.subject,
      compact,
    });
    await db()
      .from('chapter_versions')
      .update({ status: 'ready', content: lesson, removed_quotes: removed, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens })
      .eq('id', versionId);
    await logUsage('lesson', usage);
    if (found?.error) await db().from('chapter_versions').update({ error: null }).eq('id', versionId); // best effort
    return { status: 'ready', lesson, versionId, removedQuotes: removed };
  } catch (e) {
    console.error('lesson generation failed', e);
    const error = errorCode(e).slice(0, 300);
    // Saving the reason needs migration 007; without it, still mark the lesson as failed.
    const { error: noColumn } = await db().from('chapter_versions').update({ status: 'failed', error }).eq('id', versionId);
    if (noColumn) await db().from('chapter_versions').update({ status: 'failed' }).eq('id', versionId);
    return { status: 'failed', versionId, reason: explainLessonError(error) };
  }
}
