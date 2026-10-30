// The learner's reading journey: get it (with progress) or save a new order.
import { body, db, getCaller, handle, HttpError } from '@/lib/server';
import { bookProgress, journeyCandidates, type JourneyItem } from '@/lib/journey';

export const GET = handle(async (req) => {
  const c = await getCaller(req);
  const { data: j } = await db().from('journeys').select('*').eq('user_id', c.user.id).maybeSingle();
  const candidates = await journeyCandidates(c);
  const byId = new Map(candidates.map((b) => [b.id, b]));
  const items = ((j?.items || []) as JourneyItem[]).filter((i) => byId.has(i.bookId));
  const prog = await bookProgress(
    c.user.id,
    items.map((i) => i.bookId),
  );
  const list = items.map((i) => ({ ...byId.get(i.bookId)!, why: i.why || null, progress: prog[i.bookId] || { total: 0, done: 0 } }));
  const next = list.find((b) => !b.progress.total || b.progress.done < b.progress.total) || null;
  return Response.json({
    journey: j ? { title: j.title, keywords: j.keywords, items: list } : null,
    next: next ? { id: next.id, title: next.title } : null,
    candidates,
  });
});

export const PUT = handle(async (req) => {
  const c = await getCaller(req);
  const b = await body<{ title?: string; keywords?: string; items: JourneyItem[] }>(req);
  if (!Array.isArray(b.items)) throw new HttpError(400, 'Nothing to save.');
  const allowed = new Set((await journeyCandidates(c)).map((x) => x.id));
  const seen = new Set<string>();
  const items = b.items
    .filter((i) => allowed.has(i.bookId) && !seen.has(i.bookId) && seen.add(i.bookId))
    .slice(0, 30)
    .map((i) => ({ bookId: i.bookId, why: (i.why || '').slice(0, 300) || undefined }));
  await db()
    .from('journeys')
    .upsert({ user_id: c.user.id, title: (b.title || 'My learning journey').slice(0, 80), keywords: (b.keywords || '').slice(0, 400), items, updated_at: new Date().toISOString() });
  return Response.json({ ok: true });
});
