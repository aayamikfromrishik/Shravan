// Turns a book's raw text into a chapter list.
// Works on plain text (Gutenberg, EPUB) and on PDF text with page markers.
// The learner or admin can correct the result afterwards.

import { wordCount, firstWords } from './text';
import { LIMITS } from './config';

export interface Chapter {
  title: string;
  body: string;
  startPage?: number;
  endPage?: number;
  wordCount: number;
}

export interface ChapterResult {
  chapters: Chapter[];
  leftOut: { title: string; words: number }[]; // prefaces, contents etc. not taught by default
  method: string;
}

const PAGE_BREAK = '\f';
const NUM_WORDS = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty';
const CHAPTER_RE = new RegExp(`^(chapter|lecture|part|book|section|canto|discourse)\\s+([0-9]{1,3}|[ivxlcdm]{1,7}|${NUM_WORDS})\\b\\.?\\s*(?:[-—–:.]+\\s*)?(.*)$`, 'i');
const ROMAN_RE = /^([IVXLCDM]{1,7})\.?(?:\s+(.*))?$/;
const FRONT_MATTER_RE = /^(foreword|a foreword|preface|introduction|introductory|contents|table of contents|dedication|translator|transcriber|editor|note|acknowledg|about the author|copyright|by the same author|also by)/i;
const BACK_MATTER_RE = /^(appendix|appendices|index|general index|glossary|bibliography|footnotes|notes|endnotes)\b/i;

/** Remove Project Gutenberg header/footer and licence text. */
export function stripGutenberg(text: string): string {
  const start = text.search(/\*\*\*\s*START OF (THIS|THE) PROJECT GUTENBERG[^\n]*\n/i);
  let t = text;
  if (start >= 0) t = t.slice(t.indexOf('\n', start) + 1);
  const end = t.search(/\*\*\*\s*END OF (THIS|THE) PROJECT GUTENBERG/i);
  if (end >= 0) t = t.slice(0, end);
  const endAlt = t.search(/^End of (the )?Project Gutenberg/im);
  if (endAlt >= 0) t = t.slice(0, endAlt);
  return t.replace(/\r\n?/g, '\n');
}

/** Remove running headers, footers and bare page numbers from PDF text (pages separated by \f). */
export function cleanPdfText(pages: string[]): string[] {
  const counts = new Map<string, number>();
  const norm = (l: string) => l.trim().replace(/\s+/g, ' ');
  for (const p of pages) {
    const lines = p.split('\n').map(norm).filter(Boolean);
    const edge = new Set([...lines.slice(0, 3), ...lines.slice(-3)]);
    for (const l of edge) counts.set(l, (counts.get(l) || 0) + 1);
  }
  const repeated = new Set([...counts].filter(([l, c]) => c >= 3 && l.length < 80 && !CHAPTER_RE.test(l)).map(([l]) => l));
  return pages.map((p) => {
    const lines = p.split('\n');
    const out: string[] = [];
    lines.forEach((raw, i) => {
      const l = norm(raw);
      const nearEdge = i < 4 || i >= lines.length - 4;
      if (nearEdge && /^\d{1,4}$/.test(l)) return;
      if (nearEdge && repeated.has(l)) return;
      out.push(raw);
    });
    return out.join('\n');
  });
}

function capsRatio(s: string): number {
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (!letters) return 0;
  return letters.replace(/[^A-Z]/g, '').length / letters.length;
}

function cleanTitle(t: string): string {
  return t
    .replace(/[_*]/g, '')
    .replace(/\s{2,}\d{1,4}\s*$/, '') // trailing page number from a contents line
    .replace(/\s+/g, ' ')
    .replace(/^[-—–:.\s]+|[-—–:.\s]+$/g, '')
    .trim();
}

function titleCase(s: string): string {
  if (capsRatio(s) < 0.8) return s;
  const small = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'to', 'by', 'for', 'at', 'with', 'from']);
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

interface Line {
  text: string;
  page: number;
}
interface Heading {
  lineIdx: number;
  title: string;
  bodyStart: number; // first line index of the body
  family: 'chapter' | 'roman' | 'caps';
  label?: string; // e.g. "Chapter 3" / "IV"
}

function toLines(text: string): Line[] {
  const out: Line[] = [];
  let page = 1;
  for (const pageText of text.split(PAGE_BREAK)) {
    for (const l of pageText.split('\n')) out.push({ text: l, page });
    page++;
  }
  return out;
}

function isBlank(lines: Line[], i: number) {
  return i < 0 || i >= lines.length || !lines[i].text.trim();
}

function nextNonBlank(lines: Line[], i: number): number {
  let j = i;
  while (j < lines.length && !lines[j].text.trim()) j++;
  return j;
}

function looksLikeTitleLine(s: string): boolean {
  const t = s.trim();
  return t.length > 0 && t.length <= 70 && !/[.,;]$/.test(t) && wordCount(t) <= 12;
}

function isTitleCased(s: string): boolean {
  const small = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'to', 'by', 'for', 'at', 'with', 'from', 'is', 'are']);
  const words = s.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  const big = words.filter((w) => !small.has(w.toLowerCase().replace(/[^\p{L}]/gu, '')));
  if (!big.length) return false;
  const caps = big.filter((w) => /^[“"'(]?\p{Lu}/u.test(w)).length;
  return caps / big.length >= 0.75;
}

/** Contents pages repeat every heading; keep only the last occurrence of each label/title. */
function dedupe(heads: Heading[], key: (h: Heading) => string): Heading[] {
  const last = new Map<string, number>();
  heads.forEach((h, i) => last.set(key(h), i));
  return heads.filter((h, i) => last.get(key(h)) === i);
}

function findHeadings(lines: Line[]): Record<Heading['family'], Heading[]> {
  const res: Record<Heading['family'], Heading[]> = { chapter: [], roman: [], caps: [] };
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text.trim();
    if (!t || t.length > 90) continue;

    const ch = t.match(CHAPTER_RE);
    const chRest = ch ? cleanTitle(ch[3] || '') : '';
    const chRestOk = !chRest || capsRatio(chRest) >= 0.7 || (/^[A-Z“"']/.test(chRest) && looksLikeTitleLine(chRest));
    if (ch && chRestOk) {
      let title = chRest;
      let bodyStart = i + 1;
      if (!title) {
        // Title on the following one or two short lines.
        const j = nextNonBlank(lines, i + 1);
        if (j < lines.length && looksLikeTitleLine(lines[j].text) && !CHAPTER_RE.test(lines[j].text.trim())) {
          title = lines[j].text.trim();
          bodyStart = j + 1;
          // A title wrapped onto a second short, title-cased line ("The Mistake Usually Happens / Before the Mistake Appears").
          let k = j + 1;
          if (k < lines.length && !lines[k].text.trim() && k + 1 < lines.length && k - j <= 1) k++;
          const second = k < lines.length ? lines[k].text.trim() : '';
          if (second && second.length <= 45 && looksLikeTitleLine(second) && isTitleCased(second) && !CHAPTER_RE.test(second)) {
            title += ' ' + second;
            bodyStart = k + 1;
          }
        }
      }
      const label = `${ch[1][0].toUpperCase()}${ch[1].slice(1).toLowerCase()} ${ch[2].toUpperCase()}`;
      res.chapter.push({ lineIdx: i, title: cleanTitle(title), bodyStart, family: 'chapter', label });
      continue;
    }

    const ro = t.match(ROMAN_RE);
    if (ro && (isBlank(lines, i - 1) || isBlank(lines, i + 1))) {
      const rest = cleanTitle(ro[2] || '');
      if (rest && capsRatio(rest) < 0.7) continue; // "XI. The six calamities..." is a note, not a heading
      let title = rest;
      let bodyStart = i + 1;
      if (!title) {
        const j = nextNonBlank(lines, i + 1);
        if (j < lines.length && j - i <= 3 && capsRatio(lines[j].text) >= 0.8 && looksLikeTitleLine(lines[j].text)) {
          title = lines[j].text.trim();
          bodyStart = j + 1;
        }
      }
      res.roman.push({ lineIdx: i, title: cleanTitle(title), bodyStart, family: 'roman', label: ro[1] });
      continue;
    }

    if (
      isBlank(lines, i - 1) &&
      isBlank(lines, i + 1) &&
      /^[A-Z0-9][A-Z0-9 ,'’\-:;&!?]{3,70}$/.test(t) &&
      wordCount(t) >= 1 &&
      capsRatio(t) >= 0.95 &&
      /[A-Z]{3}/.test(t)
    ) {
      res.caps.push({ lineIdx: i, title: cleanTitle(t), bodyStart: i + 1, family: 'caps' });
    }
  }
  // When a book uses "Chapter N", ignore "Part"/"Book"/"Section" lines inside chapters.
  if (res.chapter.filter((h) => h.label?.startsWith('Chapter')).length >= 2) {
    res.chapter = res.chapter.filter((h) => h.label?.startsWith('Chapter'));
  }
  res.chapter = dedupe(res.chapter, (h) => h.label || h.title);
  res.roman = dedupe(res.roman, (h) => `${h.label}|${h.title}`);
  res.caps = dedupe(res.caps, (h) => h.title.toLowerCase());
  return res;
}

interface RawSection {
  title: string;
  body: string;
  startPage: number;
  endPage: number;
  words: number;
}

function sectionsFrom(lines: Line[], heads: Heading[]): { front: RawSection | null; sections: RawSection[] } {
  const sections: RawSection[] = [];
  const slice = (a: number, b: number) => lines.slice(a, b).map((l) => l.text).join('\n').trim();
  const front = heads.length ? slice(0, heads[0].lineIdx) : '';
  heads.forEach((h, n) => {
    const end = n + 1 < heads.length ? heads[n + 1].lineIdx : lines.length;
    const body = slice(h.bodyStart, end);
    const title = h.title ? titleCase(h.title) : h.label || `Section ${n + 1}`;
    sections.push({
      title: h.family === 'chapter' && h.label && h.title ? titleCase(h.title) : title,
      body,
      startPage: lines[h.lineIdx]?.page ?? 1,
      endPage: lines[Math.max(h.lineIdx, end - 1)]?.page ?? 1,
      words: wordCount(body),
    });
  });
  return {
    front: front ? { title: 'Front matter', body: front, startPage: 1, endPage: lines[heads[0]?.lineIdx ?? 0]?.page ?? 1, words: wordCount(front) } : null,
    sections,
  };
}

function score(sections: RawSection[]): number {
  return sections.filter((s) => s.words >= 300 && !FRONT_MATTER_RE.test(s.title)).length;
}

/** Merge runs of tiny sections (contents lines, short poems) into readable chunks. */
function groupSmall(sections: RawSection[]): RawSection[] {
  // Contents lines: tiny sections that come before the first substantial one are dropped.
  let lead = 0;
  // Drop contents lines (almost empty) and a lone title page before the first real chapter.
  while (
    lead < sections.length &&
    (sections[lead].words < 40 || (sections[lead].words < 150 && (sections[lead + 1]?.words ?? 0) >= 300))
  )
    lead++;
  const kept = sections.slice(lead);
  const out: RawSection[] = [];
  let group: RawSection[] = [];
  const flush = () => {
    if (!group.length) return;
    if (group.length === 1) out.push(group[0]);
    else {
      const first = group[0];
      const last = group[group.length - 1];
      out.push({
        title: `${first.title} – ${last.title}`,
        body: group.map((g) => `${g.title}\n\n${g.body}`).join('\n\n'),
        startPage: first.startPage,
        endPage: last.endPage,
        words: group.reduce((a, g) => a + g.words, 0),
      });
    }
    group = [];
  };
  // Books made of many short pieces (poems, aphorisms) are taught in chunks of ~1,500 words;
  // ordinary books keep each chapter on its own and only fold in near-empty sections.
  const sizes = kept.map((s) => s.words).sort((a, b) => a - b);
  const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
  const shortPieces = median < 400 && kept.length >= 8;
  for (const s of kept) {
    const standalone = shortPieces ? s.words >= 1500 : s.words >= 100;
    if (standalone) {
      flush();
      out.push(s);
    } else {
      group.push(s);
      if (group.reduce((a, g) => a + g.words, 0) >= 1500) flush();
    }
  }
  flush();
  // A short title page left at the start is not a chapter.
  while (out.length > 1 && (out[0].words < 150 || (out[0].title.includes(' – ') && out[0].words < 400 && out[1].words >= 300))) out.shift();
  return out.filter((s) => s.words > 0);
}

/** Split very long sections so one lesson stays a manageable size. */
function splitHuge(sections: RawSection[], maxWords = 12000): RawSection[] {
  const out: RawSection[] = [];
  for (const s of sections) {
    if (s.words <= maxWords) {
      out.push(s);
      continue;
    }
    const paras = s.body.split(/\n\s*\n/);
    const parts = Math.ceil(s.words / 6000);
    const target = s.words / parts;
    let buf: string[] = [];
    let n = 1;
    let w = 0;
    for (const p of paras) {
      buf.push(p);
      w += wordCount(p);
      if (w >= target && n < parts) {
        out.push({ ...s, title: `${s.title} (part ${n})`, body: buf.join('\n\n'), words: w });
        buf = [];
        w = 0;
        n++;
      }
    }
    if (buf.length) out.push({ ...s, title: `${s.title} (part ${n})`, body: buf.join('\n\n'), words: w });
  }
  return out;
}

export function detectChapters(rawText: string, opts: { isPdf?: boolean } = {}): ChapterResult {
  const text = stripGutenberg(rawText);
  const lines = toLines(text);
  const heads = findHeadings(lines);

  // Prefer explicit "Chapter N" headings, then roman numerals, then ALL-CAPS lines.
  let best: { family: string; front: RawSection | null; sections: RawSection[] } | null = null;
  for (const family of ['chapter', 'roman', 'caps'] as const) {
    if (heads[family].length < 2) continue;
    const { front, sections } = sectionsFrom(lines, heads[family]);
    const sc = score(sections);
    if (sc < 2) continue;
    if (!best) {
      best = { family, front, sections };
      continue;
    }
    const bestScore = score(best.sections);
    if (bestScore < 3 && sc > bestScore) best = { family, front, sections };
  }

  const leftOut: { title: string; words: number }[] = [];
  if (!best) {
    // No clear chapters: one labelled preview section, then parts of ~6,000 words.
    const body = text.replace(/\f/g, '\n').trim();
    const whole: RawSection = { title: 'Whole text', body, startPage: 1, endPage: lines[lines.length - 1]?.page ?? 1, words: wordCount(body) };
    const parts = splitHuge([whole], 7000).map((s, i, arr) => ({ ...s, title: arr.length > 1 ? `Part ${i + 1}` : 'Whole text' }));
    return {
      chapters: parts.map((s) => ({ title: s.title, body: s.body, startPage: s.startPage, endPage: s.endPage, wordCount: s.words })),
      leftOut,
      method: 'no-chapters',
    };
  }

  if (best.front && best.front.words >= 150) leftOut.push({ title: 'Front matter', words: best.front.words });
  // Cut appendices / index / footnotes off the end of the last chapter.
  const lastHead = best.sections.length ? best.sections[best.sections.length - 1] : null;
  if (lastHead) {
    const backIdx = lastHead.body.search(/\n\s*(APPENDIX|APPENDICES|GENERAL INDEX|INDEX|GLOSSARY|BIBLIOGRAPHY|FOOTNOTES)\b[^\n]*\n/);
    if (backIdx > 0) {
      const back = lastHead.body.slice(backIdx);
      lastHead.body = lastHead.body.slice(0, backIdx).trim();
      lastHead.words = wordCount(lastHead.body);
      leftOut.push({ title: 'Appendices and index', words: wordCount(back) });
    }
  }
  let sections = best.sections.filter((s) => {
    if (BACK_MATTER_RE.test(s.title)) {
      leftOut.push({ title: s.title, words: s.words });
      return false;
    }
    if (FRONT_MATTER_RE.test(s.title) && s.words < 6000) {
      if (s.words > 30) leftOut.push({ title: s.title, words: s.words });
      return false;
    }
    return true;
  });
  sections = splitHuge(groupSmall(sections));

  return {
    chapters: sections.map((s) => ({
      title: s.title,
      body: s.body.replace(/\f/g, '\n'),
      startPage: opts.isPdf ? s.startPage : undefined,
      endPage: opts.isPdf ? s.endPage : undefined,
      wordCount: s.words,
    })),
    leftOut,
    method: best.family,
  };
}

/** The free part: chapter 1, at most 7 pages (or ~2,000 words when there are no pages). */
export function freePart(ch: Chapter, wordsPerPage?: number): string {
  if (ch.startPage && ch.endPage && wordsPerPage) {
    const pages = ch.endPage - ch.startPage + 1;
    if (pages <= LIMITS.freePartPages) return ch.body;
    return firstWords(ch.body, Math.round(wordsPerPage * LIMITS.freePartPages));
  }
  if (ch.wordCount <= LIMITS.freePartWordsNoPages) return ch.body;
  return firstWords(ch.body, LIMITS.freePartWordsNoPages);
}

export const PDF_PAGE_BREAK = PAGE_BREAK;
