// Admin bulk creation: plan (what is missing, what it may cost) and make one item at a time.
import { db, getBook } from './server';
import { explainLessonError, getOrCreateVersion } from './versions';
import { checkChapter, type ChapterCheck } from './chapter-check';
import { getOrCreateAudio, getVoiceSettings, INR_PER_10K_CHARS, pickVoice } from './voice';
import { levelFor, type Lang, type Level, type Mode, type Part } from './config';
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
  const seen = new Set<string>();
  for (const ch of chapters || []) {
    const parts: Part[] = ['full'];
    if (args.freePart && ch.idx === 1 && ch.free_text && ch.free_text.length < ch.body.length - 20) parts.push('free');
    for (const part of parts)
      for (const mode of args.modes)
        for (const lang of args.langs)
          for (const picked of args.levels) {
            // Hindi and Mix have one level (Normal), so ticking several English levels adds them only once.
            const level = levelFor(lang, picked);
            const k = `${ch.id}|${part}|${mode}|${level}|${lang}`;
            if (seen.has(k)) continue;
            seen.add(k);
            items.push({ book: book.title, chapterId: ch.id, idx: ch.idx, part, mode, level, lang });
          }
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
  if (v.status !== 'ready' || !v.versionId || !v.lesson) {
    const busy = v.status === 'generating';
    return {
      lesson: busy ? 'busy' : 'failed',
      audio: 'not tried',
      reason: busy ? 'An earlier try is still writing this lesson. Retry in about 5 minutes.' : v.reason || explainLessonError(null),
      check: busy ? undefined : checkChapter(chapter.body),
    };
  }
  let audioState = 'skipped';
  let reason: string | undefined;
  if (audio) {
    const a = await getOrCreateAudio({ versionId: v.versionId, lesson: v.lesson as Lesson, lang: it.lang, subject: book.subject });
    audioState = a.status === 'ready' ? 'ready' : a.status === 'generating' ? 'busy' : 'failed';
    if (a.status === 'generating') reason = 'An earlier try is still recording this narration. Retry in about 5 minutes.';
    else if (a.status !== 'ready') reason = 'reason' in a && a.reason ? `Narration: ${a.reason}` : 'Narration failed.';
  }
  return { lesson: existed ? 'existing' : 'made', audio: audioState, reason };
}

export interface Problem {
  item: BulkItem;
  title: string; // chapter title
  what: 'lesson' | 'narration';
  reason: string;
  check: ChapterCheck;
}

const STUCK_MS = 6 * 60 * 1000; // longer than one request may run, so it has surely stopped

/** Lessons and narrations of these books that failed or stopped part-way, with a look at each chapter's text. */
export async function findProblems(bookIds: string[]): Promise<Problem[]> {
  const sb = db();
  const problems: Problem[] = [];
  for (const bookId of bookIds) {
    const book = await getBook(bookId);
    const { data: chapters } = await sb.from('chapters').select('id,idx,title,body').eq('book_id', bookId).order('idx');
    const byId = new Map((chapters || []).map((c) => [c.id as string, c]));
    const ids = [...byId.keys()];
    const checks = new Map<string, ChapterCheck>();
    const checkOf = (id: string) => {
      if (!checks.has(id)) checks.set(id, checkChapter(byId.get(id)?.body || ''));
      return checks.get(id)!;
    };
    const old = (t: string) => Date.now() - new Date(t).getTime() > STUCK_MS;
    for (let i = 0; i < ids.length; i += 80) {
      const some = ids.slice(i, i + 80);
      // Lessons that failed or stopped part-way ("error" needs migration 007; fall back without it).
      let rows = (await sb.from('chapter_versions').select('id,chapter_id,part,mode,level,lang,status,created_at,error').in('chapter_id', some).neq('status', 'ready')).data;
      if (!rows) rows = ((await sb.from('chapter_versions').select('id,chapter_id,part,mode,level,lang,status,created_at').in('chapter_id', some).neq('status', 'ready')).data || []).map((r) => ({ ...r, error: null }));
      for (const r of rows) {
        if (r.status === 'generating' && !old(r.created_at)) continue; // still being written right now
        const c = byId.get(r.chapter_id)!;
        problems.push({
          item: { book: book.title, chapterId: r.chapter_id, idx: c.idx, part: r.part, mode: r.mode, level: r.level, lang: r.lang },
          title: c.title,
          what: 'lesson',
          reason: explainLessonError(r.status === 'generating' ? 'stopped' : r.error),
          check: checkOf(r.chapter_id),
        });
      }
      // Narrations that failed or stopped part-way, for lessons that have no finished narration.
      const { data: audio } = await sb
        .from('lesson_audio')
        .select('version_id,status,error,created_at,chapter_versions!inner(chapter_id,part,mode,level,lang)')
        .in('chapter_versions.chapter_id', some);
      const readyFor = new Set((audio || []).filter((a) => a.status === 'ready').map((a) => a.version_id));
      const listed = new Set<string>();
      for (const a of audio || []) {
        if (a.status === 'ready' || readyFor.has(a.version_id) || listed.has(a.version_id)) continue;
        if (a.status === 'generating' && !old(a.created_at)) continue;
        listed.add(a.version_id);
        const v = (Array.isArray(a.chapter_versions) ? a.chapter_versions[0] : a.chapter_versions) as { chapter_id: string; part: Part; mode: Mode; level: Level; lang: Lang };
        const c = byId.get(v.chapter_id)!;
        problems.push({
          item: { book: book.title, chapterId: v.chapter_id, idx: c.idx, part: v.part, mode: v.mode, level: v.level, lang: v.lang },
          title: c.title,
          what: 'narration',
          reason: a.status === 'generating' ? 'The recording stopped part-way, most likely because it took more than 5 minutes. A retry usually works.' : `Narration: ${a.error || 'failed without a reason.'}`,
          check: checkOf(v.chapter_id),
        });
      }
    }
  }
  return problems.sort((a, b) => (a.item.book || '').localeCompare(b.item.book || '') || a.item.idx - b.item.idx);
}
