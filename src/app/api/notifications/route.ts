import { db, getCaller, handle } from '@/lib/server';

export const GET = handle(async (req) => {
  const c = await getCaller(req);
  const { data } = await db()
    .from('notifications')
    .select('id,title,body,link,created_at')
    .or(`user_id.is.null,user_id.eq.${c.user.id}`)
    .order('created_at', { ascending: false })
    .limit(30);
  await db().from('profiles').update({ notifications_seen_at: new Date().toISOString() }).eq('id', c.user.id);
  return Response.json({ notifications: data || [] });
});
