import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { SUBJECTS } from '../src/lib/config';

describe('starter library', () => {
  const cat = JSON.parse(readFileSync('data/library.json', 'utf8'));
  it('has unique slugs and valid subjects', () => {
    const slugs = cat.books.map((b: { slug: string }) => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const b of cat.books) expect(SUBJECTS.map((s) => s.id)).toContain(b.subject);
  });
  it('every sample file has three complete lessons', () => {
    for (const f of readdirSync('data/samples')) {
      const s = JSON.parse(readFileSync('data/samples/' + f, 'utf8'));
      expect(Object.keys(s.versions).sort()).toEqual(['complete', 'examples', 'key']);
      for (const l of Object.values<Record<string, unknown[]>>(s.versions)) {
        expect(l.key_lessons.length).toBeGreaterThanOrEqual(3);
        expect(l.reflection_questions.length).toBe(3);
      }
      expect(s.versions.complete.sections.length).toBeGreaterThan(0);
    }
  });
});
