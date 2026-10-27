// Personal actions for a chapter, built from the lesson and the learner's own reflections.
import { body, db, getCaller, handle, HttpError, logUsage } from '@/lib/server';
import { loadChapter, partFor, settingsFor } from '@/lib/learn';
import { generateActions } from '@/lib/ai';
import type { Lesson } from '@/lib/lesson';

export const maxDuration = 120;

export const POST = handle(async (req, ctx) => {
  const { chapterId } = await ctx.params;
  const c = await getCaller(req);
  const { chapter, book, access } = await loadChapter(c, chapterId);
  if (access === 'locked' || access === 'preview_needed') throw new HttpError(402, 'This chapter is locked.');
  const b = await body<{ regenerate?: boolean }>(req).catch(() => ({ regenerate: false }));

  const { data: existing } = await db().from('actions').select('*').eq('user_id', c.user.id).eq('chapter_id', chapter.id).order('created_at');
  if (existing?.length && !b.regenerate) return Response.json({ actions: existing });

  const settings = await settingsFor(c, book);
  const part = partFor(access, chapter);
  let lessonContent: Lesson | null = null;
  if (book.kind === 'readalong') {
    const { data: turns } = await db().from('readalong_turns').select('role,text').eq('user_id', c.user.id).eq('chapter_id', chapter.id).order('created_at');
    const notes = (turns || []).filter((t) => t.role === 'learner').map((t) => t.text).join(' ');
    lessonContent = { title: chapter.title, main_idea: notes || '(no notes yet)', sections: [], key_lessons: [], examples: [], takeaway: '', quotes: [], quick_check: { question: '', options: [], answer_index: 0, simpler_explanation: '' }, reflection_questions: [] };
  } else {
    const { data: v } = await db().from('chapter_versions').select('content').match({ chapter_id: chapter.id, part, ...settings, status: 'ready' }).maybeSingle();
    const { data: anyV } = v ? { data: v } : await db().from('chapter_versions').select('content').eq('chapter_id', chapter.id).eq('status', 'ready').limit(1).maybeSingle();
    lessonContent = (anyV?.content as Lesson) || null;
  }
  if (!lessonContent) throw new HttpError(409, 'Please listen to the chapter first.');

  const { data: refl } = await db().from('reflections').select('question,answer,skipped').eq('user_id', c.user.id).eq('chapter_id', chapter.id).order('q_index');
  const { actions, usage } = await generateActions({
    bookTitle: book.title,
    chapterTitle: chapter.title,
    lesson: lessonContent,
    reflections: refl || [],
    lang: settings.lang,
    subject: book.subject,
  });
  await logUsage('actions', usage);
  if (existing?.length) await db().from('actions').delete().eq('user_id', c.user.id).eq('chapter_id', chapter.id).eq('done', false);
  const rows = actions.map((a) => ({
    user_id: c.user.id,
    book_id: book.id,
    chapter_id: chapter.id,
    text: a.text,
    // Read-along has no book text, so nothing can be labelled "from the book".
    source: book.kind === 'readalong' ? 'shravan' : a.source,
    because: a.because,
  }));
  const { data: saved } = await db().from('actions').insert(rows).select('*');
  return Response.json({ actions: saved || [] });
});
