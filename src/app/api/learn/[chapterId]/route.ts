// Open a chapter: checks access, uses a free preview if needed, then returns the saved lesson
// (or writes it once if nobody has opened this version before).
import { db, getCaller, handle, HttpError, isSubscriber, usePreview } from '@/lib/server';
import { loadChapter, partFor, settingsFor } from '@/lib/learn';
import { getOrCreateVersion } from '@/lib/versions';
import { LIMITS } from '@/lib/config';

export const maxDuration = 300;

export const GET = handle(async (req, ctx) => {
  const { chapterId } = await ctx.params;
  const c = await getCaller(req);
  const url = new URL(req.url);
  const { chapter, book, access: initial } = await loadChapter(c, chapterId);
  let access = initial;

  if (book.kind === 'readalong') throw new HttpError(400, 'This is a Read-along book.');
  if (access === 'locked') {
    return Response.json({ locked: true, reason: chapter.idx === 1 ? 'no_previews' : 'subscribe', book: { id: book.id, title: book.title } }, { status: 402 });
  }
  if (access === 'preview_needed') {
    if (url.searchParams.get('confirm') !== '1') {
      return Response.json({ needsConfirm: true, book: { id: book.id, title: book.title } }, { status: 409 });
    }
    if (!(await usePreview(c, book.id))) return Response.json({ locked: true, reason: 'no_previews' }, { status: 402 });
    access = 'free_part';
  }

  const settings = await settingsFor(c, book, url.searchParams);
  const part = partFor(access, chapter);
  const v = await getOrCreateVersion({ book, chapter, part, ...settings });

  // Remember where the learner is.
  await db()
    .from('user_books')
    .upsert({ user_id: c.user.id, book_id: book.id, current_chapter: chapter.idx, last_opened_at: new Date().toISOString(), ...settings }, { onConflict: 'user_id,book_id' });

  if (v.status !== 'ready') return Response.json({ status: v.status, settings }, { status: v.status === 'failed' ? 500 : 202 });

  const [{ data: prog }, { data: refl }, { data: acts }, { data: usage }, { count: chapterCount }] = await Promise.all([
    db().from('progress').select('*').eq('user_id', c.user.id).eq('chapter_id', chapter.id).maybeSingle(),
    db().from('reflections').select('*').eq('user_id', c.user.id).eq('chapter_id', chapter.id).order('q_index'),
    db().from('actions').select('*').eq('user_id', c.user.id).eq('chapter_id', chapter.id).order('created_at'),
    db().from('ask_usage').select('count').eq('user_id', c.user.id).eq('chapter_id', chapter.id).maybeSingle(),
    db().from('chapters').select('*', { count: 'exact', head: true }).eq('book_id', book.id),
  ]);
  const { data: nextCh } = await db().from('chapters').select('id,idx,title').eq('book_id', book.id).eq('idx', chapter.idx + 1).maybeSingle();

  return Response.json({
    status: 'ready',
    book: { id: book.id, title: book.title, author: book.author, subject: book.subject },
    chapter: { id: chapter.id, idx: chapter.idx, title: chapter.title, count: chapterCount || 0 },
    next: nextCh,
    part,
    settings,
    lesson: v.lesson,
    versionId: v.versionId,
    removedQuotes: v.removedQuotes || 0,
    progress: prog,
    reflections: refl || [],
    actions: acts || [],
    canAsk: c.isAdmin || isSubscriber(c.profile),
    asksLeft: Math.max(0, LIMITS.askPerChapter - (usage?.count || 0)),
  });
});
