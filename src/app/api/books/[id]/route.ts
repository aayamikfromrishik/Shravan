import { bookIsFreeNow, canSeeBook, chapterAccess, db, getBook, getCaller, handle, HttpError, isSubscriber } from '@/lib/server';
import { LIMITS } from '@/lib/config';

export const GET = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  const c = await getCaller(req);
  const book = await getBook(id);
  if (!(await canSeeBook(c, book))) throw new HttpError(404, 'Book not found.');

  const { data: chapters } = await db()
    .from('chapters')
    .select('id,idx,title,word_count,start_page,end_page,free_text')
    .eq('book_id', id)
    .order('idx');
  const { data: ub } = await db().from('user_books').select('*').eq('user_id', c.user.id).eq('book_id', id).maybeSingle();
  const ids = (chapters || []).map((ch) => ch.id);
  const { data: prog } = ids.length
    ? await db().from('progress').select('chapter_id,completed,listened').eq('user_id', c.user.id).in('chapter_id', ids)
    : { data: [] };
  const done = new Set((prog || []).filter((p) => p.completed).map((p) => p.chapter_id));

  const first = chapters?.[0];
  const firstAccess = first ? await chapterAccess(c, book, first) : { access: 'locked', previewsLeft: 0 };
  const full = c.isAdmin || isSubscriber(c.profile) || bookIsFreeNow(book);
  const totalWords = (chapters || []).reduce((a, ch) => a + (ch.word_count || 0), 0);
  const freeWords = first?.free_text ? first.free_text.split(/\s+/).length : 0;

  return Response.json({
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      edition: book.edition,
      subject: book.subject,
      kind: book.kind,
      status: book.status,
      status_note: book.status_note,
      free_until: book.free_until,
      free_now: bookIsFreeNow(book),
      is_library: book.is_library,
      needs_own_copy: book.needs_own_copy,
      buy_url: book.buy_url,
      page_count: book.page_count,
      word_count: book.word_count,
      source_type: book.source_type,
      uploaded_by_me: book.created_by === c.user.id,
      can_edit_chapters: c.isAdmin || (book.created_by === c.user.id && !book.is_library),
    },
    source: {
      textWords: book.word_count || totalWords,
      taughtWords: totalWords,
      chapters: chapters?.length || 0,
      freePartWords: freeWords,
      freePartIsWholeChapter: !!first && freeWords >= (first.word_count || 0) - 5,
      freePartPages: LIMITS.freePartPages,
    },
    chapters: (chapters || []).map((ch) => ({
      id: ch.id,
      idx: ch.idx,
      title: ch.title,
      words: ch.word_count,
      pages: ch.start_page ? `${ch.start_page}–${ch.end_page}` : null,
      completed: done.has(ch.id),
      open: full || done.has(ch.id) || ch.idx === 1,
    })),
    settings: ub ? { mode: ub.mode, level: ub.level, lang: ub.lang, current_chapter: ub.current_chapter, current_step: ub.current_step } : null,
    defaults: { mode: c.profile.default_mode, level: c.profile.default_level, lang: c.profile.default_language },
    firstAccess: firstAccess.access,
    previewsLeft: firstAccess.previewsLeft,
    fullAccess: full,
  });
});
