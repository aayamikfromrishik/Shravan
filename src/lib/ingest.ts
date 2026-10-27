// Store a book's text and chapters. Used by uploads, admin additions and the seed script.
import type { SupabaseClient } from '@supabase/supabase-js';
import { detectChapters, freePart, type Chapter } from './chapters';
import type { Extracted } from './extract';
import { fingerprint, wordCount } from './text';

export interface IngestMeta {
  title?: string;
  author?: string | null;
  edition?: string | null;
  subject?: string | null;
  isLibrary?: boolean;
  published?: boolean;
  needsOwnCopy?: boolean;
  rights?: 'public_domain' | 'own_work' | 'permission' | null;
  sourceUrl?: string | null;
  slug?: string | null;
  createdBy?: string | null;
  skipUntil?: string | null; // cut everything before this marker (e.g. an editor's introduction)
}

export interface IngestResult {
  bookId: string;
  existing: boolean; // same edition already in SHRAVAN
  chapters: { idx: number; title: string; words: number }[];
  leftOut: { title: string; words: number }[];
  method: string;
}

export async function ingestText(sb: SupabaseClient, ex: Extracted, meta: IngestMeta): Promise<IngestResult> {
  let text = ex.text;
  if (meta.skipUntil) {
    const i = text.indexOf(meta.skipUntil);
    if (i >= 0) text = text.slice(i + meta.skipUntil.length);
  }
  const fp = fingerprint(text);

  const { data: existing } = await sb.from('books').select('id').eq('fingerprint', fp).maybeSingle();
  if (existing) {
    const { data: chs } = await sb.from('chapters').select('idx,title,word_count').eq('book_id', existing.id).order('idx');
    return {
      bookId: existing.id,
      existing: true,
      chapters: (chs || []).map((c) => ({ idx: c.idx, title: c.title, words: c.word_count })),
      leftOut: [],
      method: 'existing',
    };
  }

  const detected = detectChapters(text, { isPdf: ex.isPdf });
  const wordsPerPage = ex.pageCount ? ex.wordCount / ex.pageCount : undefined;

  const { data: book, error } = await sb
    .from('books')
    .insert({
      slug: meta.slug ?? null,
      title: meta.title || ex.title || 'Untitled book',
      author: meta.author ?? ex.author ?? null,
      edition: meta.edition ?? null,
      subject: meta.subject ?? null,
      is_library: !!meta.isLibrary,
      published: !!meta.published,
      needs_own_copy: !!meta.needsOwnCopy,
      rights: meta.rights ?? null,
      source_url: meta.sourceUrl ?? null,
      source_type: ex.isPdf ? 'pdf' : meta.sourceUrl ? 'text' : 'epub',
      fingerprint: fp,
      page_count: ex.pageCount ?? null,
      word_count: wordCount(text),
      status: 'ready',
      status_note: detected.leftOut.length
        ? `Not taught by default: ${detected.leftOut.map((l) => `${l.title} (${l.words.toLocaleString('en-IN')} words)`).join(', ')}.`
        : null,
      created_by: meta.createdBy ?? null,
    })
    .select('id')
    .single();
  if (error || !book) throw new Error('Could not save the book: ' + error?.message);

  await saveChapters(sb, book.id, detected.chapters, wordsPerPage);
  return {
    bookId: book.id,
    existing: false,
    chapters: detected.chapters.map((c, i) => ({ idx: i + 1, title: c.title, words: c.wordCount })),
    leftOut: detected.leftOut,
    method: detected.method,
  };
}

export async function saveChapters(sb: SupabaseClient, bookId: string, chapters: Chapter[], wordsPerPage?: number) {
  const rows = chapters.map((c, i) => ({
    book_id: bookId,
    idx: i + 1,
    title: c.title,
    body: c.body,
    free_text: i === 0 ? freePart(c, wordsPerPage) : null,
    start_page: c.startPage ?? null,
    end_page: c.endPage ?? null,
    word_count: c.wordCount,
  }));
  for (let i = 0; i < rows.length; i += 20) {
    const { error } = await sb.from('chapters').insert(rows.slice(i, i + 20));
    if (error) throw new Error('Could not save chapters: ' + error.message);
  }
}
