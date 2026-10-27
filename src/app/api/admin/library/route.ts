// Admin: the starter library. GET shows what is imported; POST {slug} imports one book; POST {samples:true} attaches sample lessons.
import { body, db, handle, HttpError } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';
import { attachSamples, importBook, loadCatalogue } from '@/lib/library';

export const maxDuration = 300;

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const cat = await loadCatalogue();
  const { data } = await db().from('books').select('id,slug,status').not('slug', 'is', null);
  const bySlug = new Map((data || []).map((b) => [b.slug as string, b]));
  return Response.json({
    books: cat.books.map((b) => ({ ...b, imported: bySlug.has(b.slug), bookId: bySlug.get(b.slug)?.id || null })),
    ownBooks: cat.ownBooks,
  });
});

export const POST = handle(async (req) => {
  const c = await requireAdmin(req);
  const b = await body<{ slug?: string; samples?: boolean }>(req);
  if (b.samples) return Response.json({ results: await attachSamples(db()) });
  if (!b.slug) throw new HttpError(400, 'Which book?');
  return Response.json(await importBook(db(), b.slug, c.user.id));
});
