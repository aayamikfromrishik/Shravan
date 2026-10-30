// Admin bulk creation: plan (what is missing, what it may cost) and make one item at a time.
import { db, getBook } from './server';
import { getOrCreateVersion } from './versions';
import { getOrCreateAudio, getVoiceSettings, INR_PER_10K_CHARS, pickVoice } from './voice';
import type { Lang, Level, Mode, Part } from './config';
import type { Lesson } from './lesson';

// Rough averages (₹) for estimates: Claude writing one lesson version, and the spoken length of each mode.
export const LESSON_INR: Record<Lang, number> = { english: 4, hindi: 6, mix: 6 };
export const SPOKEN_CHARS: Record<Mode, number> = { key: 1200, examples: 2000, complete: 4000 };

export interface BulkItem {
  book?: string; // title, for the progress log
  chapterId: string;
  idx: number;
  part: Part;
  mode: Mode;
  level: Level;
  lang: Lang;
}

export async function planBulk(args: { bookId: string; from: number; to: number; modes: Mode[]; levels: Level[]; langs: Lang[]; audio: boolean; freePart: boolean }) {
  const sb = db();
  const book = await getBook(args.bookId);
  const { data: chapters } = await sb
    .from('chapters')
    .select('id,idx,body,free_text')
    .eq('book_id', args.bookId)
    .gte('idx', args.from)
    .lte('idx', args.to)
    .order('idx');
  const items: BulkItem[] = [];
  for (const ch of chapters || []) {
    const parts: Part[] = ['full'];
    if (args.freePart && ch.idx === 1 && ch.free_text && ch.free_text.length < ch.body.length - 20) parts.push('free');
    for (const part of parts) for (const mode of args.modes) for (const level of args.levels) for (const lang of args.langs) items.push({ book: book.title, chapterId: ch.id, idx: ch.idx, part, mode, level, lang });
  }

  // What already exists costs nothing.
  const ids = (chapters || []).map((c) => c.id);
  const { data: versions } = ids.length
    ? await sb.from('chapter_versions').select('id,chapter_id,part,mode,level,lang,status').in('chapter_id', ids).eq('status', 'ready')
    : { data: [] };
  const key = (x: { chapter_id?: string; chapterId?: string; part: string; mode: string; level: string; lang: string }) => `${x.chapter_id || x.chapterId}|${x.part}|${x.mode}|${x.level}|${x.lang}`;
  const have = new Map((versions || []).map((v) => [key(v), v.id as string]));
  const settings = await getVoiceSettings();
  const voiceFor = (lang: Lang) => {
    const { speaker } = pickVoice(settings, lang, book.subject);
    return { voice: `${speaker}@${settings.pace}`, factor: speaker.includes('_') ? 1 : 3 };
  };
  const vids = [...have.values()];
  const { data: audios } = args.audio && vids.length ? await db().from('lesson_audio').select('version_id,voice').in('version_id', vids).eq('status', 'ready') : { data: [] };
  const haveAudio = new Set((audios || []).map((a) => `${a.version_id}|${a.voice}`));

  let lessonsToMake = 0;
  let audioToMake = 0;
  let estimate = 0;
  for (const it of items) {
    const vid = have.get(key(it));
    if (!vid) {
      lessonsToMake++;
      estimate += LESSON_INR[it.lang];
    }
    if (args.audio) {
      const { voice, factor } = voiceFor(it.lang);
      if (!vid || !haveAudio.has(`${vid}|${voice}`)) {
        audioToMake++;
        estimate += (SPOKEN_CHARS[it.mode] / 10000) * INR_PER_10K_CHARS * factor;
      }
    }
  }
  return { book: { id: book.id, title: book.title }, items, total: items.length, lessonsToMake, audioToMake, estimateInr: Math.round(estimate) };
}

/** Suggested books for a trial set: up to `per` published books with text in each section (sample-lesson books first). */
export async function trialPicks(per: number) {
  const { SUBJECTS } = await import('./config');
  const sb = db();
  const { data: books } = await sb
    .from('books')
    .select('id,title,subject,slug')
    .eq('is_library', true)
    .eq('published', true)
    .eq('status', 'ready')
    .eq('needs_own_copy', false)
    .order('title');
  const { data: samples } = await sb.from('chapter_versions').select('chapter_id').eq('is_sample', true);
  const sampleChapters = new Set((samples || []).map((s) => s.chapter_id));
  const { data: firstChapters } = await sb.from('chapters').select('id,book_id').eq('idx', 1).in('book_id', (books || []).map((b) => b.id));
  const hasSample = new Set((firstChapters || []).filter((c) => sampleChapters.has(c.id)).map((c) => c.book_id));
  return SUBJECTS.map((s) => {
    const list = (books || []).filter((b) => b.subject === s.id).sort((a, b) => Number(hasSample.has(b.id)) - Number(hasSample.has(a.id)));
    return { id: s.id, name: s.name, books: list.map((b, i) => ({ id: b.id, title: b.title, sample: hasSample.has(b.id), picked: i < per })) };
  });
}

/** Make (or confirm) one lesson version and, if asked, its narration. */
export async function makeOne(it: BulkItem, audio: boolean) {
  const sb = db();
  const { data: chapter } = await sb.from('chapters').select('*').eq('id', it.chapterId).single();
  const book = await getBook(chapter.book_id);
  const key = { chapter_id: it.chapterId, part: it.part, mode: it.mode, level: it.level, lang: it.lang };
  const { data: before } = await sb.from('chapter_versions').select('id,status').match(key).maybeSingle();
  const existed = before?.status === 'ready';
  const v = await getOrCreateVersion({ book, chapter, part: it.part, mode: it.mode, level: it.level, lang: it.lang });
  if (v.status !== 'ready' || !v.versionId || !v.lesson) return { lesson: v.status === 'generating' ? 'busy' : 'failed', audio: 'skipped' };
  let audioState = 'skipped';
  if (audio) {
    const a = await getOrCreateAudio({ versionId: v.versionId, lesson: v.lesson as Lesson, lang: it.lang, subject: book.subject });
    audioState = a.status === 'ready' ? 'ready' : a.status === 'generating' ? 'busy' : `${a.status}: ${'reason' in a ? a.reason : ''}`;
  }
  return { lesson: existed ? 'existing' : 'made', audio: audioState };
}
