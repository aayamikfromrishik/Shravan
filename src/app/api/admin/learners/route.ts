// Admin: give or remove subscriber access by email (for trials before payments are switched on).
import { body, db, handle, HttpError } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const { data } = await db().from('profiles').select('id,email,name,plan,subscribed_until,created_at').order('created_at', { ascending: false }).limit(200);
  return Response.json({ learners: data || [] });
});

export const POST = handle(async (req) => {
  await requireAdmin(req);
  const b = await body<{ email: string; plan: 'free' | 'subscriber'; days?: number }>(req);
  const email = (b.email || '').trim().toLowerCase();
  const { data: p } = await db().from('profiles').select('id').ilike('email', email).maybeSingle();
  if (!p) throw new HttpError(404, 'No learner with that email has signed in yet.');
  const until = b.plan === 'subscriber' && b.days ? new Date(Date.now() + b.days * 86400000).toISOString() : null;
  await db().from('profiles').update({ plan: b.plan, subscribed_until: until }).eq('id', p.id);
  return Response.json({ ok: true });
});
