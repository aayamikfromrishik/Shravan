// Admin: lessons and narrations that failed or stopped part-way, with the reason and a look at each chapter.
import { body, handle, HttpError } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';
import { findProblems } from '@/lib/bulk';

export const maxDuration = 60;

export const POST = handle(async (req) => {
  await requireAdmin(req);
  const b = await body<{ bookId?: string; bookIds?: string[] }>(req);
  const ids = b.bookIds?.length ? b.bookIds : b.bookId ? [b.bookId] : [];
  if (!ids.length) throw new HttpError(400, 'Choose a book.');
  return Response.json({ problems: await findProblems(ids) });
});
