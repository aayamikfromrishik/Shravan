// Get a saved lesson, or write it once (the first learner to ask pays the AI cost; everyone after reuses it).
import { db, logUsage, type BookRow } from './server';
import { generateLesson } from './ai';
import type { Lang, Level, Mode, Part } from './config';
import type { Lesson } from './lesson';

export interface VersionResult {
  status: 'ready' | 'generating' | 'failed';
  lesson?: Lesson;
  versionId?: string;
  removedQuotes?: number;
  isSample?: boolean;
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
  const key = { chapter_id: args.chapter.id, part: args.part, mode: args.mode, level: args.level, lang: args.lang };
  const { data: found } = await db().from('chapter_versions').select('*').match(key).maybeSingle();
  if (found?.status === 'ready') {
    return { status: 'ready', lesson: found.content as Lesson, versionId: found.id, removedQuotes: found.removed_quotes, isSample: found.is_sample };
  }
  if (found?.status === 'generating' && Date.now() - new Date(found.created_at).getTime() < STALE_MS) {
    return { status: 'generating', versionId: found.id };
  }

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
    });
    await db()
      .from('chapter_versions')
      .update({ status: 'ready', content: lesson, removed_quotes: removed, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens })
      .eq('id', versionId);
    await logUsage('lesson', usage);
    return { status: 'ready', lesson, versionId, removedQuotes: removed };
  } catch (e) {
    console.error('lesson generation failed', e);
    await db().from('chapter_versions').update({ status: 'failed' }).eq('id', versionId);
    return { status: 'failed', versionId };
  }
}
