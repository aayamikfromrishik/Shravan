// Admin: make a book free for everyone for N days (or end it now). Notifies all learners.
import { body, db, handle, HttpError } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';
import { formatDate, notify } from '@/lib/notify';

export const POST = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  await requireAdmin(req);
  const b = await body<{ days: number; reminder?: boolean }>(req);
  const days = Math.floor(Number(b.days));
  const { data: book } = await db().from('books').select('id,title,status').eq('id', id).maybeSingle();
  if (!book) throw new HttpError(404, 'Book not found.');

  if (!days || days <= 0) {
    await db().from('books').update({ free_until: null, free_reminder_sent: true }).eq('id', id);
    return Response.json({ ok: true, free_until: null });
  }
  if (days > 365) throw new HttpError(400, 'Choose up to 365 days.');
  if (book.status !== 'ready') throw new HttpError(400, 'This book has no text yet, so it cannot be made free.');

  const until = new Date(Date.now() + days * 24 * 3600 * 1000);
  await db().from('books').update({ free_until: until.toISOString(), free_reminder_sent: b.reminder === false }).eq('id', id);
  await notify({
    title: `${book.title} is free for ${days} day${days > 1 ? 's' : ''}`,
    body: `Free for everyone until ${formatDate(until)}. Start any time; chapters you finish stay yours.`,
    link: `/book/${id}`,
    bookId: id,
  });
  return Response.json({ ok: true, free_until: until.toISOString() });
});
