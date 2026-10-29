// Admin: make one lesson version (and its narration) as part of a bulk run.
import { body, handle, HttpError } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';
import { makeOne, type BulkItem } from '@/lib/bulk';

export const maxDuration = 300;

export const POST = handle(async (req) => {
  await requireAdmin(req);
  const b = await body<{ item: BulkItem; audio: boolean }>(req);
  if (!b.item?.chapterId) throw new HttpError(400, 'Nothing to make.');
  return Response.json(await makeOne(b.item, !!b.audio));
});
