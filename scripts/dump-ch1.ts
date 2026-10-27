import { readFileSync, writeFileSync } from 'fs';
import { extractAny } from '../src/lib/extract';
import { detectChapters, freePart } from '../src/lib/chapters';
import { fingerprint } from '../src/lib/text';
async function main() {
  const [file, out, skip] = process.argv.slice(2);
  const ex = await extractAny(new Uint8Array(readFileSync(file)), file);
  let text = ex.text;
  if (skip) { const i = text.indexOf(skip); if (i >= 0) text = text.slice(i + skip.length); }
  const r = detectChapters(text, { isPdf: ex.isPdf });
  const c = r.chapters[0];
  const wpp = ex.pageCount ? ex.wordCount / ex.pageCount : undefined;
  const fp = freePart(c, wpp);
  writeFileSync(out, `TITLE: ${c.title}\nWORDS: ${c.wordCount}\nFREE_WORDS: ${fp.split(/\s+/).length}\nFINGERPRINT: ${fingerprint(text)}\n\n${fp}`);
  console.log(out, c.title, c.wordCount, fp.split(/\s+/).length);
}
main();
