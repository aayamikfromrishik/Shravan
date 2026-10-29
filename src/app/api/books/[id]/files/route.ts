// The original files of a book that the caller may download.
import { canSeeBook, db, getBook, getCaller, handle, HttpError } from '@/lib/server';
import { learnerDownloadsOn } from '@/lib/files';

export const GET = handle(async (req, ctx) => {
  const { id } = await ctx.params;
  const c = await getCaller(req);
  const book = await getBook(id);
  if (!(await canSeeBook(c, book))) throw new HttpError(404, 'Book not found.');
  const { data } = await db().from('book_files').select('id,user_id,file_name,size_bytes,created_at').eq('book_id', id).order('created_at');
  const files = (data || []).filter((f) => {
    if (c.isAdmin) return true;
    if (!learnerDownloadsOn()) return false;
    if (f.user_id === c.user.id) return true;
    return f.user_id === null && book.is_library && book.rights === 'public_domain';
  });
  return Response.json({ files: files.map((f) => ({ id: f.id, fileName: f.file_name, size: f.size_bytes, mine: f.user_id === c.user.id })) });
});
