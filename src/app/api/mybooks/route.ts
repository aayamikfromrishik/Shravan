import { db, getCaller, handle } from '@/lib/server';

export const GET = handle(async (req) => {
  const c = await getCaller(req);
  const { data } = await db()
    .from('user_books')
    .select('book_id,current_chapter,last_opened_at,books(id,title,author,kind,is_library,created_by)')
    .eq('user_id', c.user.id)
    .order('last_opened_at', { ascending: false });
  const books = (data || [])
    .map((r) => {
      const b = r.books as unknown as { id: string; title: string; author: string | null; kind: string; is_library: boolean; created_by: string | null } | null;
      return b ? { id: b.id, title: b.title, author: b.author, kind: b.kind, uploaded: !b.is_library && b.created_by === c.user.id, chapter: r.current_chapter } : null;
    })
    .filter(Boolean);
  return Response.json({ books });
});
