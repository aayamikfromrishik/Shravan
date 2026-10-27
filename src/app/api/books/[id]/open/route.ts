// Start (or change settings for) a book: remembers mode, level and language.
import { body, canSeeBook, db, getBook, getCaller, handle, HttpError } from '@/lib/server';

export const POST = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  const c = await getCaller(req);
  const book = await getBook(id);
  if (!(await canSeeBook(c, book))) throw new HttpError(404, 'Book not found.');
  const b = await body<{ mode?: string; level?: string; lang?: string; current_chapter?: number; current_step?: string }>(req);
  const row: Record<string, unknown> = { user_id: c.user.id, book_id: id, last_opened_at: new Date().toISOString() };
  if (b.mode && ['key', 'examples', 'complete'].includes(b.mode)) row.mode = b.mode;
  if (b.level && ['basic', 'normal', 'advanced'].includes(b.level)) row.level = b.level;
  if (b.lang && ['english', 'hindi', 'mix'].includes(b.lang)) row.lang = b.lang;
  if (typeof b.current_chapter === 'number') row.current_chapter = b.current_chapter;
  if (b.current_step && ['listen', 'reflect', 'apply'].includes(b.current_step)) row.current_step = b.current_step;
  await db().from('user_books').upsert(row, { onConflict: 'user_id,book_id' });
  return Response.json({ ok: true });
});
