import { db, getCaller, handle } from '@/lib/server';

export const GET = handle(async (req) => {
  const c = await getCaller(req);
  const subject = new URL(req.url).searchParams.get('subject');
  let q = db()
    .from('books')
    .select('id,title,author,edition,subject,needs_own_copy,buy_url,free_until,published,status')
    .eq('is_library', true)
    .order('title');
  if (!c.isAdmin) q = q.eq('published', true);
  if (subject) q = q.eq('subject', subject);
  const { data } = await q;
  return Response.json({ books: data || [] });
});
