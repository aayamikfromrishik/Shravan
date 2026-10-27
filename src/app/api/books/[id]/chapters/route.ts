// Fix the chapter list: rename a chapter, or merge it with the next one.
// Allowed for the admin and for the learner who uploaded a private book.
import { body, db, getBook, getCaller, handle, HttpError } from '@/lib/server';
import { freePart } from '@/lib/chapters';

export const PATCH = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  const c = await getCaller(req);
  const book = await getBook(id);
  if (!(c.isAdmin || (book.created_by === c.user.id && !book.is_library))) throw new HttpError(403, 'Only the person who added this book can change its chapters.');
  const b = await body<{ action: 'rename' | 'merge_next'; idx: number; title?: string }>(req);
  const sb = db();
  const { data: chapters } = await sb.from('chapters').select('*').eq('book_id', id).order('idx');
  const list = chapters || [];
  const cur = list.find((ch) => ch.idx === b.idx);
  if (!cur) throw new HttpError(404, 'Chapter not found.');

  if (b.action === 'rename') {
    const title = (b.title || '').trim().slice(0, 120);
    if (!title) throw new HttpError(400, 'Please type a title.');
    await sb.from('chapters').update({ title }).eq('id', cur.id);
    return Response.json({ ok: true });
  }

  if (b.action === 'merge_next') {
    const next = list.find((ch) => ch.idx === b.idx + 1);
    if (!next) throw new HttpError(400, 'There is no next chapter to merge.');
    const merged = {
      body: `${cur.body}\n\n${next.title}\n\n${next.body}`,
      word_count: (cur.word_count || 0) + (next.word_count || 0),
      end_page: next.end_page ?? cur.end_page,
    };
    const wpp = book.page_count && book.word_count ? book.word_count / book.page_count : undefined;
    const free_text = cur.idx === 1 ? freePart({ title: cur.title, body: merged.body, wordCount: merged.word_count, startPage: cur.start_page ?? undefined, endPage: merged.end_page ?? undefined }, wpp) : null;
    // Lessons for the changed chapters are no longer valid.
    await sb.from('chapter_versions').delete().in('chapter_id', [cur.id, next.id]);
    await sb.from('chapters').update({ ...merged, free_text }).eq('id', cur.id);
    await sb.from('chapters').delete().eq('id', next.id);
    // Close the gap in numbering.
    for (const ch of list.filter((x) => x.idx > next.idx)) {
      await sb.from('chapters').update({ idx: ch.idx - 1 }).eq('id', ch.id);
    }
    return Response.json({ ok: true });
  }
  throw new HttpError(400, 'Unknown change.');
});
