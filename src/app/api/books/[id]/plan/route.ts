// End-of-book action plan: the book's ideas first, then SHRAVAN's suggestions, then what to revisit.
import { bookIsFreeNow, body, canSeeBook, db, getBook, getCaller, handle, HttpError, isSubscriber, logUsage } from '@/lib/server';
import { generateBookPlan } from '@/lib/ai';
import type { Lang } from '@/lib/config';

export const maxDuration = 120;

export const GET = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  const c = await getCaller(req);
  const book = await getBook(id);
  if (!(await canSeeBook(c, book))) throw new HttpError(404, 'Book not found.');
  const { data: plan } = await db().from('book_plans').select('*').eq('user_id', c.user.id).eq('book_id', id).maybeSingle();
  const { data: actions } = await db().from('actions').select('id,text,source,done,is_first,chapter_id').eq('user_id', c.user.id).eq('book_id', id).order('created_at');
  return Response.json({ book: { id: book.id, title: book.title }, plan: plan?.content || null, actions: actions || [] });
});

export const POST = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  const c = await getCaller(req);
  const book = await getBook(id);
  if (!(await canSeeBook(c, book))) throw new HttpError(404, 'Book not found.');
  const b = await body<{ ticks?: Record<string, boolean> }>(req).catch(() => ({}) as { ticks?: Record<string, boolean> });
  if (b.ticks) {
    // Save which plan items are done.
    const { data: existing } = await db().from('book_plans').select('content').eq('user_id', c.user.id).eq('book_id', id).maybeSingle();
    if (existing) await db().from('book_plans').update({ content: { ...existing.content, ticks: b.ticks } }).eq('user_id', c.user.id).eq('book_id', id);
    return Response.json({ ok: true });
  }
  if (!c.isAdmin && !isSubscriber(c.profile) && !bookIsFreeNow(book)) throw new HttpError(402, 'The end-of-book action plan is part of the subscription.');

  const sb = db();
  const { data: chapters } = await sb.from('chapters').select('id,title,idx').eq('book_id', id).order('idx');
  const titles = new Map((chapters || []).map((ch) => [ch.id, ch.title]));
  const { data: actions } = await sb.from('actions').select('text,source,done,chapter_id').eq('user_id', c.user.id).eq('book_id', id);
  const ids = (chapters || []).map((ch) => ch.id);
  const { data: prog } = ids.length ? await sb.from('progress').select('chapter_id,quick_check,completed').eq('user_id', c.user.id).in('chapter_id', ids) : { data: [] };
  const { data: skipped } = ids.length ? await sb.from('reflections').select('chapter_id,question').eq('user_id', c.user.id).eq('skipped', true).in('chapter_id', ids) : { data: [] };
  const revisit = [
    ...(prog || []).filter((p) => p.quick_check === 'missed' || p.quick_check === 'skipped').map((p) => `${titles.get(p.chapter_id)}: main idea needs another look`),
    ...(skipped || []).map((s) => `${titles.get(s.chapter_id)}: skipped question "${s.question}"`),
  ];
  const { data: ub } = await sb.from('user_books').select('lang').eq('user_id', c.user.id).eq('book_id', id).maybeSingle();
  const { plan, usage } = await generateBookPlan({
    bookTitle: book.title,
    actions: (actions || []).map((a) => ({ text: a.text, source: a.source, done: a.done, chapter: titles.get(a.chapter_id) || '' })),
    revisit,
    lang: ((ub?.lang as Lang) || 'mix') as Lang,
  });
  await logUsage('plan', usage);
  if (book.kind === 'readalong') {
    plan.suggestions = [...plan.book_ideas, ...plan.suggestions];
    plan.book_ideas = [];
  }
  await sb.from('book_plans').upsert({ user_id: c.user.id, book_id: id, content: plan }, { onConflict: 'user_id,book_id' });
  return Response.json({ plan });
});
