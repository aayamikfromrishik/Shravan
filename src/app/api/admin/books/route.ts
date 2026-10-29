// Admin: list library books, and add a book for every learner (upload or link).
import { body, db, handle, HttpError } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';
import { extractAny, extractPlain } from '@/lib/extract';
import { ingestText } from '@/lib/ingest';
import { keepFile } from '@/lib/files';

export const maxDuration = 300;

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const { data } = await db()
    .from('books')
    .select('id,title,author,edition,subject,published,needs_own_copy,free_until,status,status_note,word_count,rights,created_at')
    .eq('is_library', true)
    .order('subject')
    .order('title');
  return Response.json({ books: data || [] });
});

interface AddBook {
  source: 'upload' | 'link' | 'placeholder';
  path?: string;
  fileName?: string;
  url?: string;
  title: string;
  author?: string;
  edition?: string;
  subject: string;
  rights?: 'public_domain' | 'own_work' | 'permission';
  buyUrl?: string;
}

export const POST = handle(async (req) => {
  const c = await requireAdmin(req);
  const b = await body<AddBook>(req);
  if (!b.title?.trim() || !b.subject) throw new HttpError(400, 'Title and subject are required.');
  const sb = db();

  // A "bring your own copy" title: shown in the library, no text.
  if (b.source === 'placeholder') {
    const { data, error } = await sb
      .from('books')
      .insert({ title: b.title.trim(), author: b.author || null, subject: b.subject, is_library: true, published: false, needs_own_copy: true, buy_url: b.buyUrl || null, status: 'no_text', source_type: 'none', created_by: c.user.id })
      .select('id')
      .single();
    if (error) throw new HttpError(500, error.message);
    return Response.json({ ok: true, bookId: data.id });
  }

  if (!b.rights) throw new HttpError(400, 'Choose the copyright status before adding a book for everyone.');

  let ex;
  let kept: { bytes: Uint8Array; fileName: string } | null = null;
  if (b.source === 'link') {
    if (!b.url || !/^https:\/\//.test(b.url)) throw new HttpError(400, 'Paste a full https link to a plain-text or PDF/EPUB file.');
    const res = await fetch(b.url);
    if (!res.ok) throw new HttpError(400, `Could not download that link (${res.status}).`);
    const type = res.headers.get('content-type') || '';
    const buf = new Uint8Array(await res.arrayBuffer());
    kept = { bytes: buf, fileName: decodeURIComponent(new URL(b.url).pathname.split('/').pop() || 'book.txt') };
    if (type.includes('pdf') || b.url.toLowerCase().endsWith('.pdf')) ex = await extractAny(buf, 'book.pdf');
    else if (type.includes('epub') || b.url.toLowerCase().endsWith('.epub')) ex = await extractAny(buf, 'book.epub');
    else ex = extractPlain(new TextDecoder().decode(buf));
  } else {
    if (!b.path) throw new HttpError(400, 'Upload a file first.');
    const { data: file, error } = await sb.storage.from('uploads').download(b.path);
    if (error || !file) throw new HttpError(404, 'Upload not found.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    kept = { bytes, fileName: b.fileName || 'book.pdf' };
    ex = await extractAny(bytes, b.fileName || 'book.pdf');
    await sb.storage.from('uploads').remove([b.path]);
  }
  if (!ex.ok) return Response.json({ ok: false, status: ex.status, note: ex.note });

  const r = await ingestText(sb, ex, {
    title: b.title.trim(),
    author: b.author || null,
    edition: b.edition || null,
    subject: b.subject,
    isLibrary: true,
    published: false,
    rights: b.rights,
    sourceUrl: b.url || null,
    createdBy: c.user.id,
  });
  if (kept) await keepFile({ bookId: r.bookId, userId: null, ...kept });
  if (r.existing) {
    await sb.from('books').update({ is_library: true, subject: b.subject, rights: b.rights, title: b.title.trim(), author: b.author || null, edition: b.edition || null }).eq('id', r.bookId);
  }
  const { data: book } = await sb.from('books').select('page_count,word_count,status_note').eq('id', r.bookId).single();
  return Response.json({ ok: true, bookId: r.bookId, existing: r.existing, chapters: r.chapters, leftOut: r.leftOut, method: r.method, pageCount: book?.page_count, words: book?.word_count });
});
