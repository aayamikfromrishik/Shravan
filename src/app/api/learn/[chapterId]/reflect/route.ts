// Save one reflection answer (or a skip) to the learner's private journal.
import { body, db, getCaller, handle, HttpError } from '@/lib/server';
import { loadChapter } from '@/lib/learn';

export const POST = handle(async (req, ctx) => {
  const { chapterId } = await ctx.params;
  const c = await getCaller(req);
  const { chapter, access } = await loadChapter(c, chapterId);
  if (access === 'locked' || access === 'preview_needed') throw new HttpError(402, 'This chapter is locked.');
  const b = await body<{ q_index: number; question: string; answer?: string; skipped?: boolean }>(req);
  if (typeof b.q_index !== 'number' || !b.question) throw new HttpError(400, 'Missing question.');
  await db()
    .from('reflections')
    .upsert(
      {
        user_id: c.user.id,
        chapter_id: chapter.id,
        q_index: b.q_index,
        question: b.question.slice(0, 500),
        answer: b.skipped ? null : (b.answer || '').slice(0, 4000),
        skipped: !!b.skipped,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,chapter_id,q_index' },
    );
  return Response.json({ ok: true });
});
