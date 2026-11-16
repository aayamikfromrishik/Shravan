// Drive mode: the learner listened to this chapter; its questions wait for later and the next chapter opens.
import { db, getCaller, handle, HttpError } from '@/lib/server';
import { loadChapter } from '@/lib/learn';
import { LIMITS } from '@/lib/config';

export const POST = handle(async (req, ctx) => {
  const { chapterId } = await ctx.params;
  const c = await getCaller(req);
  const { chapter, book, access } = await loadChapter(c, chapterId);
  if (access === 'locked' || access === 'preview_needed') throw new HttpError(402, 'This chapter is locked.');
  const sb = db();

  const { data: cur } = await sb.from('progress').select('completed,questions_pending').eq('user_id', c.user.id).eq('chapter_id', chapter.id).maybeSingle();
  const { count } = await sb.from('progress').select('*', { count: 'exact', head: true }).eq('user_id', c.user.id).eq('questions_pending', true);
  let pending = count || 0;
  const addsOne = !cur?.completed && !cur?.questions_pending;
  if (addsOne && pending >= LIMITS.drivePendingMax) {
    return Response.json({ limit: true, pending, max: LIMITS.drivePendingMax }, { status: 409 });
  }

  await sb
    .from('progress')
    .upsert({ user_id: c.user.id, chapter_id: chapter.id, listened: true, questions_pending: !cur?.completed, updated_at: new Date().toISOString() }, { onConflict: 'user_id,chapter_id' });
  if (addsOne) pending++;

  const { data: next } = await sb.from('chapters').select('id,idx,title').eq('book_id', book.id).eq('idx', chapter.idx + 1).maybeSingle();
  await sb
    .from('user_books')
    .update({ current_chapter: next ? next.idx : chapter.idx, current_step: 'listen', last_opened_at: new Date().toISOString() })
    .eq('user_id', c.user.id)
    .eq('book_id', book.id);
  return Response.json({ next: next || null, finishedBook: !next, pending, max: LIMITS.drivePendingMax, room: Math.max(0, LIMITS.drivePendingMax - pending) });
});
