// A learner's reading journey: their chosen order of books, with progress. Server only.
import { db, type Caller } from './server';
import { SUBJECTS } from './config';

export interface JourneyItem {
  bookId: string;
  why?: string;
}

/** Books this learner can put in a journey: the published library plus their own uploads / read-alongs. */
export async function journeyCandidates(c: Caller) {
  const sb = db();
  const { data: lib } = await sb.from('books').select('id,title,author,subject,needs_own_copy,kind').eq('is_library', true).eq('published', true).order('title');
  const { data: mine } = await sb.from('user_books').select('books(id,title,author,subject,needs_own_copy,kind,is_library)').eq('user_id', c.user.id);
  const own = (mine || [])
    .map((m) => m.books as unknown as { id: string; title: string; author: string | null; subject: string | null; needs_own_copy: boolean; kind: string; is_library: boolean } | null)
    .filter((b): b is NonNullable<typeof b> => !!b && !b.is_library);
  const all = [...(lib || []), ...own.map((b) => ({ ...b, mine: true }))];
  return all.map((b) => ({
    id: b.id as string,
    title: b.title as string,
    author: (b.author as string | null) ?? null,
    subject: (b.subject as string | null) ?? null,
    section: SUBJECTS.find((s) => s.id === b.subject)?.name || 'My books',
    ownCopy: !!b.needs_own_copy,
    mine: 'mine' in b,
  }));
}

/** Chapters done / total for each book. */
export async function bookProgress(userId: string, bookIds: string[]) {
  if (!bookIds.length) return {};
  const sb = db();
  const { data: chapters } = await sb.from('chapters').select('id,book_id').in('book_id', bookIds);
  const chIds = (chapters || []).map((c) => c.id);
  const { data: prog } = chIds.length ? await sb.from('progress').select('chapter_id').eq('user_id', userId).eq('completed', true).in('chapter_id', chIds) : { data: [] };
  const done = new Set((prog || []).map((p) => p.chapter_id));
  const out: Record<string, { total: number; done: number }> = {};
  for (const ch of chapters || []) {
    out[ch.book_id] ??= { total: 0, done: 0 };
    out[ch.book_id].total++;
    if (done.has(ch.id)) out[ch.book_id].done++;
  }
  return out;
}
