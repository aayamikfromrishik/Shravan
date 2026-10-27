// "My actions": every action across all books.
import { db, getCaller, handle } from '@/lib/server';

export const GET = handle(async (req) => {
  const c = await getCaller(req);
  const { data } = await db()
    .from('actions')
    .select('id,text,source,because,is_first,done,done_at,remind_at,created_at,book_id,chapter_id,books(title),chapters(title,idx)')
    .eq('user_id', c.user.id)
    .order('created_at', { ascending: false })
    .limit(300);
  return Response.json({ actions: data || [] });
});
