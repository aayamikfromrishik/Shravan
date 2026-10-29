// A short-lived download link for one kept book file.
import { db, getBook, getCaller, handle, HttpError } from '@/lib/server';
import { downloadUrl, learnerDownloadsOn } from '@/lib/files';

export const GET = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  const c = await getCaller(req);
  const { data: f } = await db().from('book_files').select('*').eq('id', id).maybeSingle();
  if (!f) throw new HttpError(404, 'File not found.');
  let ok = c.isAdmin;
  if (!ok && learnerDownloadsOn()) {
    const book = await getBook(f.book_id);
    ok = f.user_id === c.user.id || (f.user_id === null && book.is_library && book.rights === 'public_domain');
  }
  if (!ok) throw new HttpError(403, 'Downloads are not available for this book.');
  return Response.json({ url: await downloadUrl(f) });
});
