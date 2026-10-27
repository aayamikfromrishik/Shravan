// Mark a chapter finished and move the bookmark to the next chapter.
import { db, getCaller, handle, HttpError } from '@/lib/server';
import { loadChapter } from '@/lib/learn';

export const POST = handle(async (req, ctx) => {
  const { chapterId } = await ctx.params;
  const c = await getCaller(req);
  const { chapter, book, access } = await loadChapter(c, chapterId);
  if (access === 'locked' || access === 'preview_needed') throw new HttpError(402, 'This chapter is locked.');
  // The free part of a longer chapter 1 does not count as finishing chapter 1.
  const partial = access === 'free_part' && !!chapter.free_text && chapter.free_text.length < chapter.body.length - 20;
  await db()
    .from('progress')
    .upsert({ user_id: c.user.id, chapter_id: chapter.id, completed: !partial, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id,chapter_id' });
  const { data: next } = await db().from('chapters').select('id,idx').eq('book_id', book.id).eq('idx', chapter.idx + 1).maybeSingle();
  await db()
    .from('user_books')
    .update({ current_chapter: next ? next.idx : chapter.idx, current_step: 'listen', last_opened_at: new Date().toISOString() })
    .eq('user_id', c.user.id)
    .eq('book_id', book.id);
  return Response.json({ ok: true, next: next || null, finishedBook: !next, partial });
});
