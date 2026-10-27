// A learner reports a problem with a lesson; the admin sees it under "Flagged summaries".
import { body, db, getCaller, handle, HttpError } from '@/lib/server';
import { loadChapter } from '@/lib/learn';

export const POST = handle(async (req, ctx) => {
  const { chapterId } = await ctx.params;
  const c = await getCaller(req);
  await loadChapter(c, chapterId);
  const b = await body<{ versionId: string; note?: string }>(req);
  if (!b.versionId) throw new HttpError(400, 'Missing lesson.');
  await db()
    .from('chapter_versions')
    .update({ flagged: true, flag_note: (b.note || '').slice(0, 500) })
    .eq('id', b.versionId)
    .eq('chapter_id', chapterId);
  return Response.json({ ok: true });
});
