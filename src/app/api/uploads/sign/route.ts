// Gives the app a one-time link to upload a book file straight to private storage
// (files can be up to 30 MB, too big to pass through the server).
import { body, db, getCaller, handle, HttpError } from '@/lib/server';
import { LIMITS } from '@/lib/config';

export const POST = handle(async (req) => {
  const c = await getCaller(req);
  const b = await body<{ fileName: string; size: number }>(req);
  const name = (b.fileName || '').toLowerCase();
  if (!/\.(pdf|epub)$/.test(name) && !(c.isAdmin && name.endsWith('.txt'))) throw new HttpError(400, 'Please choose a PDF or EPUB file.');
  if (b.size > LIMITS.maxUploadMB * 1024 * 1024) throw new HttpError(400, `Files can be up to ${LIMITS.maxUploadMB} MB.`);
  const ext = name.slice(name.lastIndexOf('.'));
  const path = `${c.user.id}/${crypto.randomUUID()}${ext}`;
  const { data, error } = await db().storage.from('uploads').createSignedUploadUrl(path);
  if (error || !data) throw new HttpError(500, 'Could not prepare the upload.');
  return Response.json({ path, token: data.token });
});
