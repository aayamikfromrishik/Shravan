// Shared loading for the learning routes.
import { canSeeBook, chapterAccess, db, getBook, HttpError, type BookRow, type Caller } from './server';
import type { Lang, Level, Mode, Part } from './config';

export interface ChapterRow {
  id: string;
  book_id: string;
  idx: number;
  title: string;
  body: string;
  free_text: string | null;
  word_count: number;
}

export async function loadChapter(c: Caller, chapterId: string) {
  const { data: chapter } = await db().from('chapters').select('*').eq('id', chapterId).maybeSingle();
  if (!chapter) throw new HttpError(404, 'Chapter not found.');
  const book = await getBook(chapter.book_id);
  if (!(await canSeeBook(c, book))) throw new HttpError(404, 'Chapter not found.');
  const { access, previewsLeft } = await chapterAccess(c, book, chapter);
  return { chapter: chapter as ChapterRow, book, access, previewsLeft };
}

export function partFor(access: string, chapter: ChapterRow): Part {
  if (access !== 'free_part') return 'full';
  if (!chapter.free_text || chapter.free_text.length >= chapter.body.length - 20) return 'full';
  return 'free';
}

export async function settingsFor(c: Caller, book: BookRow, q?: URLSearchParams): Promise<{ mode: Mode; level: Level; lang: Lang }> {
  const { data: ub } = await db().from('user_books').select('mode,level,lang').eq('user_id', c.user.id).eq('book_id', book.id).maybeSingle();
  const pick = <T extends string>(name: string, allowed: readonly T[], fallback: T): T => {
    const v = q?.get(name) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  };
  return {
    mode: pick('mode', ['key', 'examples', 'complete'] as const, (ub?.mode || c.profile.default_mode || 'examples') as Mode),
    level: pick('level', ['basic', 'normal', 'advanced'] as const, (ub?.level || c.profile.default_level || 'normal') as Level),
    lang: pick('lang', ['english', 'hindi', 'mix'] as const, (ub?.lang || c.profile.default_language || 'mix') as Lang),
  };
}
