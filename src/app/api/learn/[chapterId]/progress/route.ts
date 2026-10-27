import { body, db, getCaller, handle, HttpError } from '@/lib/server';
import { loadChapter } from '@/lib/learn';

export const POST = handle(async (req, ctx) => {
  const { chapterId } = await ctx.params;
  const c = await getCaller(req);
  const { chapter, book, access } = await loadChapter(c, chapterId);
  if (access === 'locked' || access === 'preview_needed') throw new HttpError(402, 'This chapter is locked.');
  const b = await body<{ speech_position?: number; listened?: boolean; quick_check?: 'right' | 'missed' | 'skipped'; step?: string }>(req);
  const row: Record<string, unknown> = { user_id: c.user.id, chapter_id: chapter.id, updated_at: new Date().toISOString() };
  if (typeof b.speech_position === 'number') row.speech_position = Math.max(0, Math.floor(b.speech_position));
  if (typeof b.listened === 'boolean') row.listened = b.listened;
  if (b.quick_check && ['right', 'missed', 'skipped'].includes(b.quick_check)) row.quick_check = b.quick_check;
  await db().from('progress').upsert(row, { onConflict: 'user_id,chapter_id' });
  if (b.step && ['listen', 'reflect', 'apply'].includes(b.step)) {
    await db().from('user_books').update({ current_step: b.step, current_chapter: chapter.idx }).eq('user_id', c.user.id).eq('book_id', book.id);
  }
  return Response.json({ ok: true });
});
