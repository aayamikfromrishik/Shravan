// Admin: what a bulk run would make, and a cost estimate (existing lessons and audio cost nothing).
import { body, handle, HttpError } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';
import { planBulk } from '@/lib/bulk';
import type { Lang, Level, Mode } from '@/lib/config';

export const POST = handle(async (req) => {
  await requireAdmin(req);
  const b = await body<{ bookId: string; from?: number; to?: number; modes: Mode[]; levels: Level[]; langs: Lang[]; audio: boolean; freePart?: boolean }>(req);
  if (!b.bookId) throw new HttpError(400, 'Choose a book.');
  if (!b.modes?.length || !b.levels?.length || !b.langs?.length) throw new HttpError(400, 'Choose at least one mode, level and language.');
  return Response.json(await planBulk({ bookId: b.bookId, from: b.from || 1, to: b.to || 100000, modes: b.modes, levels: b.levels, langs: b.langs, audio: !!b.audio, freePart: b.freePart !== false }));
});
