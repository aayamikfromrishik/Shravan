// Start a Read-along book (a book the learner has on paper; there is no text).
import { body, db, getCaller, handle, HttpError } from '@/lib/server';

export const POST = handle(async (req) => {
  const c = await getCaller(req);
  const b = await body<{ title: string; author?: string }>(req);
  const title = (b.title || '').trim().slice(0, 160);
  if (!title) throw new HttpError(400, 'Please type the book title.');
  const sb = db();
  const { data: book, error } = await sb
    .from('books')
    .insert({ title, author: (b.author || '').trim().slice(0, 120) || null, kind: 'readalong', status: 'no_text', source_type: 'none', created_by: c.user.id })
    .select('id')
    .single();
  if (error || !book) throw new HttpError(500, 'Could not start Read-along.');
  await sb.from('chapters').insert({ book_id: book.id, idx: 1, title: 'Chapter 1', body: '' });
  await sb.from('user_books').insert({ user_id: c.user.id, book_id: book.id, lang: c.profile.default_language, level: c.profile.default_level });
  return Response.json({ bookId: book.id });
});
