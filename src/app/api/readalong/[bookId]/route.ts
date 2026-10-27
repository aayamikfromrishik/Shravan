// Read-along conversation: the learner shares what they understood; SHRAVAN works only from those notes.
import { body, chapterAccess, db, getBook, getCaller, handle, HttpError, logUsage, usePreview } from '@/lib/server';
import { readAlongReply } from '@/lib/ai';
import { LIMITS, type Lang } from '@/lib/config';

const REFLECT: Record<Lang, string[]> = {
  english: [
    'Which idea from this chapter matters most to you right now, and why?',
    'Where does this idea already show up in your own life?',
    'What would change if you acted on it this week?',
  ],
  hindi: [
    'इस अध्याय का कौन-सा विचार अभी आपके लिए सबसे ज़रूरी है, और क्यों?',
    'यह विचार आपकी अपनी ज़िंदगी में कहाँ पहले से दिखता है?',
    'अगर आप इस हफ़्ते इस पर अमल करें, तो क्या बदलेगा?',
  ],
  mix: [
    'इस chapter का कौन-सा idea अभी आपके लिए सबसे important है, और क्यों?',
    'यह idea आपकी life में कहाँ पहले से दिखता है?',
    'अगर आप इस week इस पर action लें, तो क्या बदलेगा?',
  ],
};

async function load(req: Request, bookId: string) {
  const c = await getCaller(req);
  const book = await getBook(bookId);
  if (book.kind !== 'readalong' || (book.created_by !== c.user.id && !c.isAdmin)) throw new HttpError(404, 'Book not found.');
  return { c, book };
}

export const GET = handle(async (req, ctx) => {
  const { bookId } = await ctx.params;
  const { c, book } = await load(req, bookId);
  const url = new URL(req.url);
  const idx = Number(url.searchParams.get('chapter') || 1);
  const sb = db();
  let { data: chapter } = await sb.from('chapters').select('id,idx,title').eq('book_id', bookId).eq('idx', idx).maybeSingle();
  if (!chapter) {
    const { data: prev } = await sb.from('chapters').select('idx').eq('book_id', bookId).eq('idx', idx - 1).maybeSingle();
    if (!prev) throw new HttpError(404, 'Chapter not found.');
    const { data: created } = await sb.from('chapters').insert({ book_id: bookId, idx, title: `Chapter ${idx}`, body: '' }).select('id,idx,title').single();
    chapter = created;
  }
  if (!chapter) throw new HttpError(404, 'Chapter not found.');
  const { access, previewsLeft } = await chapterAccess(c, book, chapter);
  const { data: turns } = await sb.from('readalong_turns').select('role,text,created_at').eq('user_id', c.user.id).eq('chapter_id', chapter.id).order('created_at');
  const { data: ub } = await sb.from('user_books').select('lang').eq('user_id', c.user.id).eq('book_id', bookId).maybeSingle();
  const lang = ((ub?.lang as Lang) || 'mix') as Lang;
  const learnerTurns = (turns || []).filter((t) => t.role === 'learner').length;
  return Response.json({
    book: { id: book.id, title: book.title, author: book.author },
    chapter,
    access,
    previewsLeft,
    turns: turns || [],
    followUpsLeft: Math.max(0, LIMITS.readAlongFollowUps - Math.max(0, learnerTurns - 1)),
    reflectionQuestions: REFLECT[lang],
    lang,
  });
});

export const POST = handle(async (req, ctx) => {
  const { bookId } = await ctx.params;
  const { c, book } = await load(req, bookId);
  const b = await body<{ chapterId: string; text: string; confirmPreview?: boolean }>(req);
  const sb = db();
  const { data: chapter } = await sb.from('chapters').select('id,idx,title').eq('id', b.chapterId).eq('book_id', bookId).maybeSingle();
  if (!chapter) throw new HttpError(404, 'Chapter not found.');
  const { access } = await chapterAccess(c, book, chapter);
  if (access === 'locked') throw new HttpError(402, 'Subscribe to carry on with the next chapters.');
  if (access === 'preview_needed') {
    if (!b.confirmPreview || !(await usePreview(c, book.id))) throw new HttpError(402, 'This uses one of your free previews.');
  }
  const text = (b.text || '').trim().slice(0, 2000);
  if (!text) throw new HttpError(400, 'Please type or say your notes.');

  const { data: turns } = await sb.from('readalong_turns').select('role,text').eq('user_id', c.user.id).eq('chapter_id', chapter.id).order('created_at');
  const learnerTurns = (turns || []).filter((t) => t.role === 'learner').length;
  if (learnerTurns >= LIMITS.readAlongFollowUps + 1) throw new HttpError(429, 'That is all the follow-ups for this chapter. Move on to Reflect.');

  await sb.from('readalong_turns').insert({ user_id: c.user.id, chapter_id: chapter.id, role: 'learner', text });
  const { data: ub } = await sb.from('user_books').select('lang').eq('user_id', c.user.id).eq('book_id', bookId).maybeSingle();
  const followUpsLeft = LIMITS.readAlongFollowUps - learnerTurns;
  const r = await readAlongReply({
    bookTitle: book.title,
    chapterLabel: chapter.title,
    turns: [...((turns || []) as { role: 'learner' | 'shravan'; text: string }[]), { role: 'learner', text }],
    lang: ((ub?.lang as Lang) || 'mix') as Lang,
    followUpsLeft,
  });
  await logUsage('readalong', r.usage);
  await sb.from('readalong_turns').insert({ user_id: c.user.id, chapter_id: chapter.id, role: 'shravan', text: r.reply });
  await sb.from('user_books').update({ current_chapter: chapter.idx, last_opened_at: new Date().toISOString() }).eq('user_id', c.user.id).eq('book_id', bookId);
  return Response.json({ reply: r.reply, followUpsLeft: Math.max(0, followUpsLeft) });
});
