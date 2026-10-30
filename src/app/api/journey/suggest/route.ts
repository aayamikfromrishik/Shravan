// AI help: suggest a journey from the learner's keywords (a few per day, fair use).
import { body, db, getCaller, handle, HttpError, logUsage } from '@/lib/server';
import { journeyCandidates } from '@/lib/journey';
import { suggestJourney } from '@/lib/ai';

const PER_DAY = 10;
export const maxDuration = 60;

export const POST = handle(async (req) => {
  const c = await getCaller(req);
  const b = await body<{ keywords: string; length?: number }>(req);
  const keywords = (b.keywords || '').trim();
  if (keywords.length < 3) throw new HttpError(400, 'Tell SHRAVAN a few words about what you want to learn.');

  const sb = db();
  const today = new Date().toISOString().slice(0, 10);
  const { data: j } = await sb.from('journeys').select('ai_day,ai_count').eq('user_id', c.user.id).maybeSingle();
  const used = j?.ai_day === today ? j.ai_count : 0;
  if (!c.isAdmin && used >= PER_DAY) throw new HttpError(429, 'You have used today’s journey suggestions. Try again tomorrow, or arrange the books yourself.');

  const books = await journeyCandidates(c);
  if (!books.length) throw new HttpError(400, 'No books are available yet.');
  const { journey, usage } = await suggestJourney({ keywords, books, lang: c.profile.default_language as 'english' | 'hindi' | 'mix', length: Math.min(Math.max(b.length || 5, 3), 8) });
  await logUsage('journey', usage);
  if (j) await sb.from('journeys').update({ ai_day: today, ai_count: used + 1 }).eq('user_id', c.user.id);
  else await sb.from('journeys').insert({ user_id: c.user.id, ai_day: today, ai_count: 1, items: [] });

  const byId = new Map(books.map((x) => [x.id, x]));
  return Response.json({
    title: journey.title,
    intro: journey.intro,
    items: journey.books.map((x) => ({ ...byId.get(x.book_id)!, why: x.why })),
  });
});
