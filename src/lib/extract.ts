// Pull plain text out of uploaded files. Server only.
import JSZip from 'jszip';
import { cleanPdfText, PDF_PAGE_BREAK, stripGutenberg } from './chapters';
import { wordCount } from './text';
import { LIMITS } from './config';

export interface Extracted {
  ok: boolean;
  status: 'ready' | 'scanned' | 'locked' | 'failed' | 'too_big';
  note?: string;
  text: string; // pages joined by \f for PDFs
  pageCount?: number;
  wordCount: number;
  title?: string;
  author?: string;
  isPdf: boolean;
  outline?: { title: string; page: number }[];
}

// ---------- PDF ----------
// The PDF reader expects a few browser drawing classes. We only read text, so simple stand-ins
// are enough when the server has no canvas library (as on some hosts).
function ensureDrawingClasses() {
  const g = globalThis as Record<string, unknown>;
  if (!g.DOMMatrix) {
    class DOMMatrixLite {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor(init?: number[]) {
        if (Array.isArray(init) && init.length >= 6) [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      }
      multiplySelf(m: DOMMatrixLite) {
        const { a, b, c, d, e, f } = this;
        this.a = a * m.a + c * m.b; this.b = b * m.a + d * m.b;
        this.c = a * m.c + c * m.d; this.d = b * m.c + d * m.d;
        this.e = a * m.e + c * m.f + e; this.f = b * m.e + d * m.f + f;
        return this;
      }
      preMultiplySelf(m: DOMMatrixLite) {
        const r = new DOMMatrixLite([m.a, m.b, m.c, m.d, m.e, m.f]).multiplySelf(this);
        Object.assign(this, { a: r.a, b: r.b, c: r.c, d: r.d, e: r.e, f: r.f });
        return this;
      }
      multiply(m: DOMMatrixLite) { return new DOMMatrixLite([this.a, this.b, this.c, this.d, this.e, this.f]).multiplySelf(m); }
      translate(x = 0, y = 0) { return this.multiply(new DOMMatrixLite([1, 0, 0, 1, x, y])); }
      scale(x = 1, y = x) { return this.multiply(new DOMMatrixLite([x, 0, 0, y, 0, 0])); }
      translateSelf(x = 0, y = 0) { return this.multiplySelf(new DOMMatrixLite([1, 0, 0, 1, x, y])); }
      scaleSelf(x = 1, y = x) { return this.multiplySelf(new DOMMatrixLite([x, 0, 0, y, 0, 0])); }
      invertSelf() {
        const { a, b, c, d, e, f } = this; const det = a * d - b * c || 1;
        Object.assign(this, { a: d / det, b: -b / det, c: -c / det, d: a / det, e: (c * f - d * e) / det, f: (b * e - a * f) / det });
        return this;
      }
      inverse() { return new DOMMatrixLite([this.a, this.b, this.c, this.d, this.e, this.f]).invertSelf(); }
    }
    g.DOMMatrix = DOMMatrixLite;
  }
  if (!g.ImageData) g.ImageData = class { constructor(public data: unknown, public width: number, public height: number) {} };
  if (!g.Path2D) g.Path2D = class { addPath() {} moveTo() {} lineTo() {} bezierCurveTo() {} quadraticCurveTo() {} closePath() {} rect() {} };
}

export async function extractPdf(data: Uint8Array): Promise<Extracted> {
  try {
    await import('@napi-rs/canvas').then((m) => {
      const g = globalThis as Record<string, unknown>;
      g.DOMMatrix ??= m.DOMMatrix; g.ImageData ??= m.ImageData; g.Path2D ??= m.Path2D;
    });
  } catch {
    // no canvas library here: fall back to the simple stand-ins
  }
  ensureDrawingClasses();
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let doc;
  try {
    doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true, isEvalSupported: false }).promise;
  } catch (e: unknown) {
    const name = (e as { name?: string })?.name || '';
    if (name === 'PasswordException') {
      return { ok: false, status: 'locked', note: 'This PDF is password-protected, so it cannot be opened.', text: '', wordCount: 0, isPdf: true };
    }
    return { ok: false, status: 'failed', note: 'This file could not be read as a PDF.', text: '', wordCount: 0, isPdf: true };
  }
  if (doc.numPages > LIMITS.maxPages) {
    return { ok: false, status: 'too_big', note: `This book has ${doc.numPages} pages; the beta limit is ${LIMITS.maxPages}.`, text: '', wordCount: 0, isPdf: true, pageCount: doc.numPages };
  }

  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = '';
    const lines: string[] = [];
    for (const item of content.items as { str?: string; transform?: number[]; hasEOL?: boolean }[]) {
      if (typeof item.str !== 'string') continue;
      const y = item.transform ? item.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        lines.push(line);
        line = '';
      }
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = '';
        lastY = null;
        continue;
      }
      lastY = y;
    }
    if (line) lines.push(line);
    // Keep paragraph gaps: a blank line where the original had a big vertical jump is lost, so mark short lines.
    pages.push(lines.join('\n'));
    page.cleanup();
  }

  let outline: { title: string; page: number }[] = [];
  try {
    const items = (await doc.getOutline()) || [];
    for (const it of items) {
      let dest = it.dest;
      if (typeof dest === 'string') dest = await doc.getDestination(dest);
      if (Array.isArray(dest) && dest[0]) {
        const idx = await doc.getPageIndex(dest[0]);
        outline.push({ title: it.title, page: idx + 1 });
      }
    }
  } catch {
    outline = [];
  }

  const meta = await doc.getMetadata().catch(() => null);
  const info = (meta?.info || {}) as { Title?: string; Author?: string };
  await doc.destroy();

  const cleaned = cleanPdfText(pages);
  const words = cleaned.reduce((a, p) => a + wordCount(p), 0);
  const avg = words / Math.max(1, pages.length);
  if (avg < LIMITS.minWordsPerPageForText) {
    return {
      ok: false,
      status: 'scanned',
      note: 'This file is made of page photos, so there is no text SHRAVAN can read. Scanned books are not supported yet.',
      text: '',
      wordCount: words,
      pageCount: pages.length,
      isPdf: true,
    };
  }
  return {
    ok: true,
    status: 'ready',
    text: cleaned.join(PDF_PAGE_BREAK),
    pageCount: pages.length,
    wordCount: words,
    title: info.Title || undefined,
    author: info.Author || undefined,
    isPdf: true,
    outline,
  };
}

// ---------- EPUB ----------
function stripHtml(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|section|tr)>/gi, '\n\n')
    .replace(/<(h[1-6])[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

export async function extractEpub(data: Uint8Array): Promise<Extracted> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    return { ok: false, status: 'failed', note: 'This file could not be read as an EPUB.', text: '', wordCount: 0, isPdf: false };
  }
  // DRM: rights.xml (Adobe) or encryption.xml that encrypts more than fonts.
  const rights = zip.file('META-INF/rights.xml');
  const enc = zip.file('META-INF/encryption.xml');
  const encXml = enc ? await enc.async('string') : '';
  const encryptedContent = [...encXml.matchAll(/URI="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => !/^https?:/i.test(u) && !/\.(otf|ttf|woff2?)$/i.test(u));
  if (rights || encryptedContent.length > 0) {
    return {
      ok: false,
      status: 'locked',
      note: 'This book is protected by the store it came from (Kindle, Google Play or Apple Books), so it cannot be opened here.',
      text: '',
      wordCount: 0,
      isPdf: false,
    };
  }
  const container = await zip.file('META-INF/container.xml')?.async('string');
  const opfPath = container?.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) return { ok: false, status: 'failed', note: 'This EPUB is missing its contents list.', text: '', wordCount: 0, isPdf: false };
  const opf = (await zip.file(opfPath)?.async('string')) || '';
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const manifest = new Map<string, string>();
  for (const m of opf.matchAll(/<item\b[^>]*>/g)) {
    const id = m[0].match(/\bid="([^"]+)"/)?.[1];
    const href = m[0].match(/\bhref="([^"]+)"/)?.[1];
    if (id && href) manifest.set(id, decodeURIComponent(href));
  }
  const spine = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map((m) => m[1]);
  const title = opf.match(/<dc:title[^>]*>([^<]+)</)?.[1];
  const author = opf.match(/<dc:creator[^>]*>([^<]+)</)?.[1];
  const parts: string[] = [];
  for (const id of spine) {
    const href = manifest.get(id);
    if (!href) continue;
    const html = await zip.file(base + href)?.async('string');
    if (html) parts.push(stripHtml(html).trim());
  }
  const text = parts.join('\n\n\n');
  const words = wordCount(text);
  if (words < 200) {
    return { ok: false, status: 'scanned', note: 'This EPUB has almost no readable text (it may be made of images).', text: '', wordCount: words, isPdf: false };
  }
  return { ok: true, status: 'ready', text, wordCount: words, title, author, isPdf: false };
}

// ---------- Plain text (Gutenberg links etc.) ----------
export function extractPlain(raw: string): Extracted {
  const text = stripGutenberg(raw);
  const title = raw.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
  const author = raw.match(/^Author:\s*(.+)$/m)?.[1]?.trim();
  return { ok: true, status: 'ready', text, wordCount: wordCount(text), title, author, isPdf: false };
}

export async function extractAny(data: Uint8Array, fileName: string): Promise<Extracted> {
  const lower = fileName.toLowerCase();
  let r: Extracted;
  if (lower.endsWith('.pdf')) r = await extractPdf(data);
  else if (lower.endsWith('.epub')) r = await extractEpub(data);
  else if (lower.endsWith('.txt')) r = extractPlain(new TextDecoder().decode(data));
  else return { ok: false, status: 'failed', note: 'Please upload a PDF or EPUB file.', text: '', wordCount: 0, isPdf: false };
  if (r.ok && r.wordCount > LIMITS.maxWords) {
    return { ...r, ok: false, status: 'too_big', note: `This book has about ${r.wordCount.toLocaleString('en-IN')} words; the beta limit is ${LIMITS.maxWords.toLocaleString('en-IN')}.`, text: '' };
  }
  return r;
}
