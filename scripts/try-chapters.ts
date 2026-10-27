// Developer check: run chapter detection on local files.
// npx tsx scripts/try-chapters.ts <file> [<file> ...]
import { readFileSync } from 'fs';
import { detectChapters, freePart } from '../src/lib/chapters';
import { extractAny } from '../src/lib/extract';

async function main() {
  for (const f of process.argv.slice(2)) {
    const data = new Uint8Array(readFileSync(f));
    const ex = await extractAny(data, f);
    console.log(`\n=== ${f}: ${ex.status} ${ex.wordCount} words, pages ${ex.pageCount ?? '-'}, outline ${ex.outline?.length ?? 0}`);
    if (!ex.ok) {
      console.log(ex.note);
      continue;
    }
    const r = detectChapters(ex.text, { isPdf: ex.isPdf });
    console.log('method', r.method, 'left out', r.leftOut);
    r.chapters.forEach((c, i) =>
      console.log(`${String(i + 1).padStart(2)}. ${c.title.slice(0, 60).padEnd(60)} ${String(c.wordCount).padStart(6)}w  p${c.startPage ?? ''}-${c.endPage ?? ''} | ${c.body.slice(0, 60).replace(/\s+/g, ' ')}`),
    );
    const c1 = r.chapters[0];
    const wpp = ex.pageCount ? ex.wordCount / ex.pageCount : undefined;
    const fp = freePart(c1, wpp);
    console.log('free part words:', fp.split(/\s+/).length, '| ends:', fp.slice(-80).replace(/\s+/g, ' '));
  }
}
main();
