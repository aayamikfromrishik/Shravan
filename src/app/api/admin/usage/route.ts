// Admin: learners, saved lessons and AI usage (counts only; never journals or actions).
import { db, handle } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';
import { INR_PER_10K_CHARS } from '@/lib/voice';

// Claude Sonnet 5.5 list prices (USD per million tokens), for a rough cost view.
const PRICE = { input: 2, output: 10, cacheRead: 0.1 };
const USD_INR = Number(process.env.USD_INR || 95);

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const sb = db();
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const [{ count: learners }, { count: subscribers }, { count: lessons }, { count: books }, { data: usage }] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('plan', 'subscriber'),
    sb.from('chapter_versions').select('*', { count: 'exact', head: true }).eq('status', 'ready'),
    sb.from('books').select('*', { count: 'exact', head: true }).eq('kind', 'text'),
    sb.from('usage_log').select('*').gte('created_at', since).limit(20000),
  ]);
  const byKind: Record<string, { calls: number; inr: number }> = {};
  let total = 0;
  for (const u of usage || []) {
    const usd = ((u.input_tokens - u.cache_read_tokens) * PRICE.input + u.output_tokens * PRICE.output + u.cache_read_tokens * PRICE.cacheRead) / 1e6;
    const inr = u.kind === 'voice' ? ((u.chars || 0) / 10000) * INR_PER_10K_CHARS : usd * USD_INR;
    byKind[u.kind] ??= { calls: 0, inr: 0 };
    byKind[u.kind].calls++;
    byKind[u.kind].inr += inr;
    total += inr;
  }
  return Response.json({ learners, subscribers, lessons, books, last30Days: { totalInr: Math.round(total), byKind } });
});
