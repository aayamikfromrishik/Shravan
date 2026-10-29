// Premium: hand the narration of a lesson to the phone so it can be kept for offline listening.
import { db, getCaller, handle, HttpError, isSubscriber } from '@/lib/server';
import { objectUrl } from '@/lib/files';

export const maxDuration = 60;

export const GET = handle(async (req, ctx) => {
  const { versionId, part } = await ctx.params;
  const c = await getCaller(req);
  if (!c.isAdmin && !isSubscriber(c.profile)) throw new HttpError(402, 'Offline listening is part of SHRAVAN Premium.');
  const voice = new URL(req.url).searchParams.get('voice');
  let q = db().from('lesson_audio').select('parts,created_at').eq('version_id', versionId).eq('status', 'ready');
  if (voice) q = q.eq('voice', voice);
  const { data: rows } = await q.order('created_at', { ascending: false }).limit(1);
  const parts = (rows?.[0]?.parts || []) as { store: string; key: string }[];
  const p = parts[Number(part)];
  if (!p) throw new HttpError(404, 'Narration not found. Play the lesson once first.');
  const res = await fetch(await objectUrl(p.store, p.key, 300), { cache: 'no-store' });
  if (!res.ok || !res.body) throw new HttpError(502, 'Could not fetch the audio.');
  return new Response(res.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store' } });
});
