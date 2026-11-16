// Chapters listened to in Drive mode whose questions are still waiting.
import { db, getCaller, handle } from '@/lib/server';
import { LIMITS } from '@/lib/config';

export const GET = handle(async (req) => {
  const c = await getCaller(req);
  const { data } = await db()
    .from('progress')
    .select('chapter_id,updated_at,chapters(id,idx,title,book_id,books(id,title))')
    .eq('user_id', c.user.id)
    .eq('questions_pending', true)
    .order('updated_at', { ascending: true });
  const items = (data || [])
    .map((p) => {
      const ch = p.chapters as unknown as { id: string; idx: number; title: string; books: { id: string; title: string } | null } | null;
      return ch ? { chapterId: ch.id, idx: ch.idx, title: ch.title, bookId: ch.books?.id || null, bookTitle: ch.books?.title || '' } : null;
    })
    .filter((x) => x !== null);
  return Response.json({ items, max: LIMITS.drivePendingMax });
});
