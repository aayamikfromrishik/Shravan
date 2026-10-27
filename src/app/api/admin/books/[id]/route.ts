// Admin: publish / unpublish / edit a library book, or remove it.
import { body, db, handle, HttpError } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';

export const PATCH = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  await requireAdmin(req);
  const b = await body<Record<string, unknown>>(req);
  const patch: Record<string, unknown> = {};
  for (const k of ['title', 'author', 'edition', 'subject', 'buy_url']) if (typeof b[k] === 'string') patch[k] = b[k];
  if (typeof b.published === 'boolean') patch.published = b.published;
  if (typeof b.rights === 'string' && ['public_domain', 'own_work', 'permission'].includes(b.rights)) patch.rights = b.rights;
  if (patch.published === true) {
    const { data: book } = await db().from('books').select('rights,needs_own_copy').eq('id', id).single();
    if (!book?.needs_own_copy && !book?.rights && !patch.rights) throw new HttpError(400, 'Set the copyright status before publishing.');
  }
  await db().from('books').update(patch).eq('id', id);
  return Response.json({ ok: true });
});

export const DELETE = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  await requireAdmin(req);
  // Library flag off; learners who uploaded the same edition keep their copy.
  const { count } = await db().from('user_books').select('*', { count: 'exact', head: true }).eq('book_id', id);
  if (count) await db().from('books').update({ is_library: false, published: false }).eq('id', id);
  else await db().from('books').delete().eq('id', id);
  return Response.json({ ok: true });
});
