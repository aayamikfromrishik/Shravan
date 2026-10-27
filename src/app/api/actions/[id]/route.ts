import { body, db, getCaller, handle, HttpError } from '@/lib/server';

export const PATCH = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  const c = await getCaller(req);
  const b = await body<{ done?: boolean; is_first?: boolean; remind_at?: string | null; text?: string }>(req);
  const { data: act } = await db().from('actions').select('id,chapter_id').eq('id', id).eq('user_id', c.user.id).maybeSingle();
  if (!act) throw new HttpError(404, 'Action not found.');
  const patch: Record<string, unknown> = {};
  if (typeof b.done === 'boolean') {
    patch.done = b.done;
    patch.done_at = b.done ? new Date().toISOString() : null;
  }
  if (typeof b.text === 'string' && b.text.trim()) patch.text = b.text.trim().slice(0, 400);
  if (b.remind_at === null || (typeof b.remind_at === 'string' && /^\d{2}:\d{2}$/.test(b.remind_at))) patch.remind_at = b.remind_at;
  if (b.is_first === true && act.chapter_id) {
    await db().from('actions').update({ is_first: false }).eq('user_id', c.user.id).eq('chapter_id', act.chapter_id);
    patch.is_first = true;
  }
  await db().from('actions').update(patch).eq('id', id);
  return Response.json({ ok: true });
});

export const DELETE = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  const c = await getCaller(req);
  await db().from('actions').delete().eq('id', id).eq('user_id', c.user.id);
  return Response.json({ ok: true });
});
