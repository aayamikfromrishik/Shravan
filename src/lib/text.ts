// Text helpers shared by the server and the phone-voice player.
import { createHash } from 'crypto';

export function wordCount(s: string): number {
  const m = s.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/** Collapse whitespace and unify quote/dash characters so word-for-word checks are fair. */
export function normalizeForMatch(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/[_*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Same edition = same fingerprint, regardless of file name or layout. */
export function fingerprint(fullText: string): string {
  const core = fullText
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
  return createHash('sha256').update(core).digest('hex');
}

export function questionKey(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Does the snippet appear in the source text (ignoring spacing, quote styles and case)? */
export function appearsIn(snippet: string, source: string): boolean {
  const s = normalizeForMatch(snippet);
  if (s.length < 12) return false;
  return normalizeForMatch(source).includes(s);
}

/** First n words of a text, cut at a sentence end when one is close. */
export function firstWords(s: string, n: number): string {
  const words = s.split(/(\s+)/);
  let count = 0;
  let out = '';
  for (const w of words) {
    if (/\S/.test(w)) count++;
    if (count > n) break;
    out += w;
  }
  const lastStop = Math.max(out.lastIndexOf('. '), out.lastIndexOf('.\n'), out.lastIndexOf('? '), out.lastIndexOf('! '));
  if (lastStop > out.length * 0.8) out = out.slice(0, lastStop + 1);
  return out.trim();
}
