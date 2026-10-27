// "Ask about this chapter" (subscribers): answered only from the chapter, reused when asked again.
import { body, db, getCaller, handle, HttpError, isSubscriber, logUsage } from '@/lib/server';
import { loadChapter, partFor, settingsFor } from '@/lib/learn';
import { answerQuestion } from '@/lib/ai';
import { LIMITS } from '@/lib/config';
import { questionKey } from '@/lib/text';

export const maxDuration = 120;

export const POST = handle(async (req, ctx) => {
  const { chapterId } = await ctx.params;
  const c = await getCaller(req);
  if (!c.isAdmin && !isSubscriber(c.profile)) throw new HttpError(402, 'Asking questions is part of the subscription.');
  const { chapter, book, access } = await loadChapter(c, chapterId);
  if (access === 'locked' || access === 'preview_needed') throw new HttpError(402, 'This chapter is locked.');
  const b = await body<{ question: string; simpler?: boolean }>(req);
  const question = (b.question || '').trim().slice(0, 400);
  if (question.length < 3) throw new HttpError(400, 'Please type or say your question.');

  const { data: usage } = await db().from('ask_usage').select('count').eq('user_id', c.user.id).eq('chapter_id', chapter.id).maybeSingle();
  const used = usage?.count || 0;
  if (!c.isAdmin && used >= LIMITS.askPerChapter) throw new HttpError(429, `You have used all ${LIMITS.askPerChapter} questions for this chapter.`);

  const settings = await settingsFor(c, book);
  const part = partFor(access, chapter);
  const key = questionKey(question);
  const cacheKey = { chapter_id: chapter.id, part, level: settings.level, lang: settings.lang, question_key: key };
  const { data: cached } = await db().from('ask_answers').select('*').match(cacheKey).maybeSingle();
  let answer = cached?.answer as string | undefined;
  let found = cached?.found_in_chapter as boolean | undefined;
  if (!answer) {
    const text = part === 'free' && chapter.free_text ? chapter.free_text : chapter.body;
    const r = await answerQuestion({ bookTitle: book.title, chapterTitle: chapter.title, chapterText: text, question, level: settings.level, lang: settings.lang });
    await logUsage('ask', r.usage);
    answer = r.answer;
    found = r.found;
    await db().from('ask_answers').upsert({ ...cacheKey, question, answer, found_in_chapter: found }, { onConflict: 'chapter_id,part,level,lang,question_key' });
  }
  await db().from('ask_usage').upsert({ user_id: c.user.id, chapter_id: chapter.id, count: used + 1 }, { onConflict: 'user_id,chapter_id' });
  return Response.json({ answer, found, asksLeft: Math.max(0, LIMITS.askPerChapter - used - 1) });
});
