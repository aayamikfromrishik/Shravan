// Search: library and my books by title/author, and topics inside books (real text only).
import { db, getCaller, handle } from '@/lib/server';

export const GET = handle(async (req) => {
  const c = await getCaller(req);
  const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 80);
  if (q.length < 2) return Response.json({ books: [], sections: [] });
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const sb = db();

  const { data: mine } = await sb.from('user_books').select('book_id').eq('user_id', c.user.id);
  const myIds = (mine || []).map((m) => m.book_id);

  const { data: libBooks } = await sb
    .from('books')
    .select('id,title,author,subject,kind,needs_own_copy')
    .eq('is_library', true)
    .eq('published', true)
    .or(`title.ilike.${like},author.ilike.${like}`)
    .limit(10);
  const { data: myBooks } = myIds.length
    ? await sb.from('books').select('id,title,author,subject,kind').in('id', myIds).or(`title.ilike.${like},author.ilike.${like}`).limit(10)
    : { data: [] };

  // Topic search inside chapters the learner may see.
  const { data: visible } = await sb.from('books').select('id,title').eq('is_library', true).eq('published', true).eq('kind', 'text');
  const visibleIds = [...new Set([...(visible || []).map((b) => b.id), ...myIds])];
  const titles = new Map((visible || []).map((b) => [b.id, b.title]));
  for (const b of myBooks || []) titles.set(b.id, b.title);
  let sections: { chapterId: string; bookId: string; bookTitle: string; chapterTitle: string; idx: number; snippet: string }[] = [];
  if (visibleIds.length) {
    const { data: hits } = await sb.from('chapters').select('id,book_id,idx,title,body').in('book_id', visibleIds).ilike('body', like).limit(12);
    sections = (hits || []).map((h) => {
      const i = h.body.toLowerCase().indexOf(q.toLowerCase());
      const start = Math.max(0, i - 80);
      const snippet = (start > 0 ? '…' : '') + h.body.slice(start, i + q.length + 100).replace(/\s+/g, ' ').trim() + '…';
      return { chapterId: h.id, bookId: h.book_id, bookTitle: titles.get(h.book_id) || '', chapterTitle: h.title, idx: h.idx, snippet };
    });
  }
  const seen = new Set<string>();
  const books = [...(myBooks || []), ...(libBooks || [])].filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)));
  return Response.json({ books, sections });
});
