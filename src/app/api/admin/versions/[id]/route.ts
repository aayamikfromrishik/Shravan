// Admin: clear a flag, or delete a lesson so it is rewritten (once) the next time someone opens it.
import { body, db, handle } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';

export const POST = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  await requireAdmin(req);
  const b = await body<{ action: 'clear' | 'regenerate' }>(req);
  if (b.action === 'regenerate') await db().from('chapter_versions').delete().eq('id', id);
  else await db().from('chapter_versions').update({ flagged: false, flag_note: null }).eq('id', id);
  return Response.json({ ok: true });
});
