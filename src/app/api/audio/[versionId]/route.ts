// The narrator's audio for a lesson version: ready links, "still being made", or a reason to use the phone voice.
import { canSeeBook, chapterAccess, db, getBook, getCaller, handle, HttpError } from '@/lib/server';
import { getOrCreateAudio } from '@/lib/voice';
import type { Lesson } from '@/lib/lesson';
import type { Lang } from '@/lib/config';

export const maxDuration = 300;

export const POST = handle(async (req, ctx) => {
  const { versionId } = await ctx.params;
  const c = await getCaller(req);
  const sb = db();
  const { data: v } = await sb.from('chapter_versions').select('id,chapter_id,part,lang,status,content').eq('id', versionId).maybeSingle();
  if (!v || v.status !== 'ready') throw new HttpError(404, 'Lesson not found.');
  const { data: ch } = await sb.from('chapters').select('id,idx,book_id').eq('id', v.chapter_id).single();
  const book = await getBook(ch!.book_id);
  if (!(await canSeeBook(c, book))) throw new HttpError(404, 'Lesson not found.');
  if (!c.isAdmin) {
    const { access } = await chapterAccess(c, book, ch!);
    const ok = access === 'full' || (access === 'free_part' && v.part === 'free');
    if (!ok) throw new HttpError(403, 'This lesson is not open for you.');
  }
  const r = await getOrCreateAudio({ versionId, lesson: v.content as Lesson, lang: v.lang as Lang, subject: book.subject });
  return Response.json(r, { status: r.status === 'generating' ? 202 : 200 });
});
