import { bookIsFreeNow, db, getCaller, handle } from '@/lib/server';
import { SUBJECTS } from '@/lib/config';
import { bookProgress } from '@/lib/journey';

export const GET = handle(async (req) => {
  const c = await getCaller(req);
  const sb = db();

  const { data: mine } = await sb
    .from('user_books')
    .select('book_id,current_chapter,current_step,last_opened_at,books(id,title,author,kind,subject)')
    .eq('user_id', c.user.id)
    .order('last_opened_at', { ascending: false })
    .limit(10);

  const continueList = [];
  for (const ub of mine || []) {
    const book = ub.books as unknown as { id: string; title: string; author: string | null; kind: string } | null;
    if (!book) continue;
    const { count } = await sb.from('chapters').select('*', { count: 'exact', head: true }).eq('book_id', book.id);
    const { data: ch } = await sb.from('chapters').select('id,title').eq('book_id', book.id).eq('idx', ub.current_chapter).maybeSingle();
    continueList.push({
      bookId: book.id,
      title: book.title,
      author: book.author,
      kind: book.kind,
      chapterIdx: ub.current_chapter,
      chapterId: ch?.id ?? null,
      chapterTitle: ch?.title ?? null,
      chapters: count || 0,
      step: ub.current_step,
    });
  }

  const { data: lib } = await sb.from('books').select('id,subject,title,free_until').eq('is_library', true).eq('published', true);
  const counts: Record<string, number> = {};
  for (const b of lib || []) if (b.subject) counts[b.subject] = (counts[b.subject] || 0) + 1;
  const freeNow = (lib || [])
    .filter(bookIsFreeNow)
    .map((b) => ({ id: b.id, title: b.title, free_until: b.free_until }));

  const { count: openActions } = await sb.from('actions').select('*', { count: 'exact', head: true }).eq('user_id', c.user.id).eq('is_first', true).eq('done', false);

  // Reading journey: what to read next.
  const { data: j } = await sb.from('journeys').select('title,items').eq('user_id', c.user.id).maybeSingle();
  let journey: { title: string; count: number; next: { id: string; title: string } | null } | null = null;
  const jItems = ((j?.items || []) as { bookId: string }[]).map((i) => i.bookId);
  if (jItems.length) {
    const prog = await bookProgress(c.user.id, jItems);
    const nextId = jItems.find((id) => !prog[id]?.total || prog[id].done < prog[id].total) || null;
    const { data: nb } = nextId ? await sb.from('books').select('id,title').eq('id', nextId).maybeSingle() : { data: null };
    journey = { title: j?.title || 'My learning journey', count: jItems.length, next: nb ? { id: nb.id, title: nb.title } : null };
  }

  return Response.json({
    journey,
    continue: continueList,
    freeNow,
    subjects: SUBJECTS.map((s) => ({ ...s, count: counts[s.id] || 0 })),
    openActions: openActions || 0,
  });
});
