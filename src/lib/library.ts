// The starter library (data/library.json) and the ready-made sample lessons (data/samples/*.json).
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractAny, extractPlain } from './extract';
import { ingestText } from './ingest';
import { verifyLesson } from './ai';
import type { Lesson } from './lesson';

export interface CatalogueBook {
  slug: string;
  title: string;
  author?: string;
  subject: string;
  edition?: string;
  url?: string;
  verified?: boolean;
  skipUntil?: string;
  sample?: boolean;
  needsOwnCopy?: boolean;
  note?: string;
  chapterPrefix?: string;
}

interface SampleFile {
  slug: string;
  fingerprint: string | null;
  chapterIdx: number;
  part: 'free' | 'full';
  level: 'normal';
  lang: 'english';
  versions: Record<'key' | 'examples' | 'complete', Lesson>;
}

const DATA = path.join(process.cwd(), 'data');

export async function loadCatalogue(): Promise<{ books: CatalogueBook[]; ownBooks: { slug: string; title: string; note: string }[] }> {
  return JSON.parse(await readFile(path.join(DATA, 'library.json'), 'utf8'));
}

async function loadSamples(): Promise<SampleFile[]> {
  const dir = path.join(DATA, 'samples');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8')) as SampleFile));
}

/** Download one catalogue book, split it into chapters and publish it. */
export async function importBook(sb: SupabaseClient, slug: string, adminId: string) {
  const { books } = await loadCatalogue();
  const b = books.find((x) => x.slug === slug);
  if (!b) return { ok: false, note: 'Not in the catalogue.' };

  const { data: have } = await sb.from('books').select('id').eq('slug', slug).maybeSingle();
  if (have) return { ok: true, bookId: have.id, note: 'Already in the library.' };

  if (b.needsOwnCopy) {
    const { data, error } = await sb
      .from('books')
      .insert({ slug, title: b.title, author: b.author || null, subject: b.subject, is_library: true, published: true, needs_own_copy: true, status: 'no_text', source_type: 'none', created_by: adminId })
      .select('id')
      .single();
    if (error) return { ok: false, note: error.message };
    return { ok: true, bookId: data.id, note: 'Added as "bring your own copy".' };
  }

  if (!b.url) return { ok: false, note: b.note || 'No link yet. Add it from Admin → Add.' };
  const res = await fetch(b.url);
  if (!res.ok) return { ok: false, note: `Could not download (${res.status}). Check the link.` };
  const buf = new Uint8Array(await res.arrayBuffer());
  const lower = b.url.toLowerCase();
  const ex = lower.endsWith('.pdf') || lower.endsWith('.epub') ? await extractAny(buf, lower.endsWith('.pdf') ? 'b.pdf' : 'b.epub') : extractPlain(new TextDecoder().decode(buf));
  if (!ex.ok) return { ok: false, note: ex.note || ex.status };

  const r = await ingestText(sb, ex, {
    slug,
    title: b.title,
    author: b.author || null,
    edition: b.edition || null,
    subject: b.subject,
    isLibrary: true,
    published: true,
    rights: 'public_domain',
    sourceUrl: b.url,
    skipUntil: b.skipUntil || null,
    createdBy: adminId,
  });
  if (r.existing) {
    await sb.from('books').update({ slug, is_library: true, published: true, subject: b.subject, rights: 'public_domain' }).eq('id', r.bookId);
  }
  if (b.chapterPrefix) {
    for (const ch of r.chapters) {
      if (!ch.title.startsWith(b.chapterPrefix)) {
        await sb.from('chapters').update({ title: b.chapterPrefix + ch.title }).eq('book_id', r.bookId).eq('idx', ch.idx);
      }
    }
  }
  return { ok: true, bookId: r.bookId, note: `${r.chapters.length} chapters${r.leftOut.length ? `; not taught: ${r.leftOut.map((l) => l.title).join(', ')}` : ''}.` };
}

/** Attach the ready-made sample lessons to the books they belong to (by slug, or by fingerprint for uploaded books). */
export async function attachSamples(sb: SupabaseClient) {
  const out: { slug: string; ok: boolean; note: string }[] = [];
  for (const s of await loadSamples()) {
    let { data: book } = await sb.from('books').select('id').eq('slug', s.slug).maybeSingle();
    if (!book && s.fingerprint) ({ data: book } = await sb.from('books').select('id').eq('fingerprint', s.fingerprint).maybeSingle());
    if (!book) {
      out.push({ slug: s.slug, ok: false, note: s.fingerprint ? 'Upload this book first (the exact same PDF).' : 'Import this book first.' });
      continue;
    }
    const { data: ch } = await sb.from('chapters').select('id,body,free_text').eq('book_id', book.id).eq('idx', s.chapterIdx).maybeSingle();
    if (!ch) {
      out.push({ slug: s.slug, ok: false, note: 'Chapter 1 not found.' });
      continue;
    }
    const source = s.part === 'free' && ch.free_text ? ch.free_text : ch.body;
    let removedTotal = 0;
    for (const [mode, lesson] of Object.entries(s.versions)) {
      const { lesson: checked, removed } = verifyLesson(lesson, source);
      removedTotal += removed;
      const { error } = await sb.from('chapter_versions').upsert(
        { chapter_id: ch.id, part: s.part, mode, level: s.level, lang: s.lang, status: 'ready', content: checked, removed_quotes: removed, is_sample: true, input_tokens: 0, output_tokens: 0 },
        { onConflict: 'chapter_id,part,mode,level,lang' },
      );
      if (error) {
        out.push({ slug: s.slug, ok: false, note: error.message });
        continue;
      }
    }
    out.push({ slug: s.slug, ok: true, note: removedTotal ? `Attached; ${removedTotal} quote(s) did not match this copy and were removed.` : 'Attached (3 modes).' });
  }
  return out;
}
