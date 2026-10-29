import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { splitParts } from '../src/lib/voice';
import { lessonSpeech, toSentences } from '../src/lib/lesson';

describe('narrator parts', () => {
  it('covers every sentence once, in order, within the size limit', () => {
    const s = JSON.parse(readFileSync('data/samples/sun-tzu-art-of-war.json', 'utf8'));
    const sentences = toSentences(lessonSpeech(s.versions.complete, 'english'));
    const parts = splitParts(sentences);
    expect(parts[0].start).toBe(0);
    expect(parts[parts.length - 1].end).toBe(sentences.length - 1);
    for (let i = 1; i < parts.length; i++) expect(parts[i].start).toBe(parts[i - 1].end + 1);
    for (const p of parts) expect(p.text.length).toBeLessThanOrEqual(2000);
    expect(parts.map((p) => p.text).join(' ')).toBe(sentences.join(' '));
  });
});
