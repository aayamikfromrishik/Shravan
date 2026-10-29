// Keeps original book files (PDF / EPUB / text) so they can be downloaded later. Server only.
// Files go to Cloudflare R2 when its keys are set in Vercel; otherwise to private Supabase storage.
import { AwsClient } from 'aws4fetch';
import { db } from './server';

const R2 = {
  // Accept the plain ID, or the whole address pasted by mistake.
  account: process.env.R2_ACCOUNT_ID?.trim().replace(/^https?:\/\//, '').split('.')[0].replace(/\/.*$/, ''),
  key: process.env.R2_ACCESS_KEY_ID?.trim(),
  secret: process.env.R2_SECRET_ACCESS_KEY?.trim(),
  bucket: process.env.R2_BUCKET?.trim() || 'shravan-files',
};
export const r2Ready = () => !!(R2.account && R2.key && R2.secret);

let client: AwsClient | null = null;
function r2() {
  client ??= new AwsClient({ accessKeyId: R2.key!, secretAccessKey: R2.secret!, service: 's3', region: 'auto' });
  return client;
}
const r2Url = (key: string) => `https://${R2.account}.r2.cloudflarestorage.com/${R2.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;

function typeFor(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.epub')) return 'application/epub+zip';
  return 'text/plain; charset=utf-8';
}

const safe = (name: string) => name.replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').slice(-80) || 'book';

/** Save a copy of a book file. Never throws: keeping the file must not stop a book from being added. */
export async function keepFile(args: { bookId: string; userId: string | null; fileName: string; bytes: Uint8Array }) {
  try {
    const sb = db();
    // One kept copy per uploader per book is enough.
    let q = sb.from('book_files').select('id').eq('book_id', args.bookId).limit(1);
    q = args.userId ? q.eq('user_id', args.userId) : q.is('user_id', null);
    const { data: have } = await q;
    if (have?.length) return;

    const contentType = typeFor(args.fileName);
    const key = `books/${args.bookId}/${crypto.randomUUID()}-${safe(args.fileName)}`;
    let store: 'r2' | 'supabase';
    if (r2Ready()) {
      const res = await r2().fetch(r2Url(key), { method: 'PUT', body: args.bytes.slice().buffer as ArrayBuffer, headers: { 'Content-Type': contentType } });
      if (!res.ok) throw new Error(`R2 upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      store = 'r2';
    } else {
      const { error } = await sb.storage.from('files').upload(key, args.bytes, { contentType, upsert: false });
      if (error) throw new Error('Supabase file save failed: ' + error.message);
      store = 'supabase';
    }
    await sb.from('book_files').insert({ book_id: args.bookId, user_id: args.userId, store, key, file_name: args.fileName, content_type: contentType, size_bytes: args.bytes.byteLength });
  } catch (e) {
    console.error('keepFile', e);
  }
}

/** Save any object (e.g. narrated audio). Uses R2 when connected, otherwise private Supabase storage. */
export async function putObject(key: string, bytes: Uint8Array, contentType: string): Promise<'r2' | 'supabase'> {
  if (r2Ready()) {
    const res = await r2().fetch(r2Url(key), { method: 'PUT', body: bytes.slice().buffer as ArrayBuffer, headers: { 'Content-Type': contentType } });
    if (!res.ok) throw new Error(`R2 upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    return 'r2';
  }
  const { error } = await db().storage.from('files').upload(key, bytes, { contentType, upsert: true });
  if (error) throw new Error('Supabase save failed: ' + error.message);
  return 'supabase';
}

/** A short-lived link to play/stream an object in the browser. */
export async function objectUrl(store: string, key: string, seconds = 6 * 3600): Promise<string> {
  if (store === 'r2') {
    const u = new URL(r2Url(key));
    u.searchParams.set('X-Amz-Expires', String(seconds));
    return (await r2().sign(new Request(u.toString()), { aws: { signQuery: true } })).url;
  }
  const { data, error } = await db().storage.from('files').createSignedUrl(key, seconds);
  if (error || !data) throw new Error('Could not make a link.');
  return data.signedUrl;
}

/** Delete objects (best effort). */
export async function removeObjects(items: { store: string; key: string }[]) {
  for (const f of items) {
    try {
      if (f.store === 'r2') await r2().fetch(r2Url(f.key), { method: 'DELETE' });
      else await db().storage.from('files').remove([f.key]);
    } catch (e) {
      console.error('removeObjects', e);
    }
  }
}

/** A short-lived link that downloads the file with its original name. */
export async function downloadUrl(f: { store: string; key: string; file_name: string }): Promise<string> {
  if (f.store === 'r2') {
    const u = new URL(r2Url(f.key));
    u.searchParams.set('X-Amz-Expires', '3600');
    u.searchParams.set('response-content-disposition', `attachment; filename="${safe(f.file_name)}"`);
    const signed = await r2().sign(new Request(u.toString()), { aws: { signQuery: true } });
    return signed.url;
  }
  const { data, error } = await db().storage.from('files').createSignedUrl(f.key, 3600, { download: f.file_name });
  if (error || !data) throw new Error('Could not make a download link.');
  return data.signedUrl;
}

/** Remove every kept file of a book (when the book itself is deleted). */
export async function removeBookFiles(bookId: string) {
  const { data } = await db().from('book_files').select('store,key').eq('book_id', bookId);
  for (const f of data || []) {
    try {
      if (f.store === 'r2') await r2().fetch(r2Url(f.key), { method: 'DELETE' });
      else await db().storage.from('files').remove([f.key]);
    } catch (e) {
      console.error('removeBookFiles', e);
    }
  }
}

/** Learners may download only when switched on: their own uploads, and public-domain library books. */
export const learnerDownloadsOn = () => process.env.LEARNER_DOWNLOADS === 'true';

/** System check: write, read back and delete a tiny test file in Cloudflare R2. */
export async function checkR2(): Promise<string> {
  if (!r2Ready()) throw new Error('R2 keys are not set in Vercel (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).');
  const key = `health/check-${Date.now()}.txt`;
  const put = await r2().fetch(r2Url(key), { method: 'PUT', body: 'ok', headers: { 'Content-Type': 'text/plain' } });
  if (!put.ok) throw new Error(`Could not save a test file (${put.status}). ${(await put.text()).slice(0, 160)}`);
  const signed = await downloadUrl({ store: 'r2', key, file_name: 'check.txt' });
  const get = await fetch(signed);
  if (!get.ok) throw new Error(`Saved, but could not read it back (${get.status}).`);
  await r2().fetch(r2Url(key), { method: 'DELETE' });
  return `bucket "${R2.bucket}" works (save, download link, delete)`;
}
