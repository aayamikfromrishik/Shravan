// Admin: what a bulk run would make, and a cost estimate (existing lessons and audio cost nothing).
import { body, handle, HttpError } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';
import { planBulk } from '@/lib/bulk';
import type { Lang, Level, Mode } from '@/lib/config';

export const POST = handle(async (req) => {
  await requireAdmin(req);
  const b = await body<{ bookId?: string; bookIds?: string[]; from?: number; to?: number; modes: Mode[]; levels: Level[]; langs: Lang[]; audio: boolean; freePart?: boolean }>(req);
  const ids = b.bookIds?.length ? b.bookIds : b.bookId ? [b.bookId] : [];
  if (!ids.length) throw new HttpError(400, 'Choose a book.');
  if (!b.modes?.length || !b.levels?.length || !b.langs?.length) throw new HttpError(400, 'Choose at least one mode, level and language.');
  const plans = await Promise.all(ids.map((bookId) => planBulk({ bookId, from: b.from || 1, to: b.to || 100000, modes: b.modes, levels: b.levels, langs: b.langs, audio: !!b.audio, freePart: b.freePart !== false })));
  return Response.json({
    items: plans.flatMap((p) => p.items),
    total: plans.reduce((a, p) => a + p.total, 0),
    lessonsToMake: plans.reduce((a, p) => a + p.lessonsToMake, 0),
    audioToMake: plans.reduce((a, p) => a + p.audioToMake, 0),
    estimateInr: plans.reduce((a, p) => a + p.estimateInr, 0),
  });
});
