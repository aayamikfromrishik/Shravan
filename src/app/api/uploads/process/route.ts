// After upload: read the text, find chapters, link to an existing copy of the same edition if there is one,
// then delete the original file (only the text is kept, privately).
import { body, db, getCaller, handle, HttpError } from '@/lib/server';
import { extractAny } from '@/lib/extract';
import { ingestText } from '@/lib/ingest';

export const maxDuration = 300;

export const POST = handle(async (req) => {
  const c = await getCaller(req);
  const b = await body<{ path: string; fileName: string; libraryBookId?: string }>(req);
  if (!b.path?.startsWith(`${c.user.id}/`)) throw new HttpError(403, 'Not your file.');
  const sb = db();
  const { data: file, error } = await sb.storage.from('uploads').download(b.path);
  if (error || !file) throw new HttpError(404, 'The upload was not found. Please try again.');
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const ex = await extractAny(bytes, b.fileName);
    if (!ex.ok) {
      return Response.json({ ok: false, status: ex.status, note: ex.note, usedPreview: false });
    }
    // A learner's copy of a library "bring your own copy" title keeps that title and subject.
    let meta: { title?: string; author?: string | null; subject?: string | null } = {};
    if (b.libraryBookId) {
      const { data: lib } = await sb.from('books').select('title,author,subject').eq('id', b.libraryBookId).maybeSingle();
      if (lib) meta = { title: lib.title, author: lib.author, subject: lib.subject };
    }
    const r = await ingestText(sb, ex, {
      ...meta,
      title: meta.title || ex.title || b.fileName.replace(/\.(pdf|epub|txt)$/i, '').replace(/[_-]+/g, ' '),
      createdBy: c.user.id,
    });
    await sb
      .from('user_books')
      .upsert(
        { user_id: c.user.id, book_id: r.bookId, mode: c.profile.default_mode, level: c.profile.default_level, lang: c.profile.default_language },
        { onConflict: 'user_id,book_id', ignoreDuplicates: true },
      );
    return Response.json({ ok: true, bookId: r.bookId, existing: r.existing, chapters: r.chapters.length, leftOut: r.leftOut });
  } finally {
    await sb.storage.from('uploads').remove([b.path]);
  }
});
