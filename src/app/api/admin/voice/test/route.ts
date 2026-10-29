// Admin: hear a voice before choosing it (costs a fraction of a rupee).
import { body, handle, HttpError } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';
import { logVoice, sarvamSpeak } from '@/lib/voice';

export const maxDuration = 60;

export const POST = handle(async (req) => {
  await requireAdmin(req);
  const b = await body<{ text: string; speaker: string; lang: string; pace?: number }>(req);
  const text = (b.text || '').trim().slice(0, 600);
  if (!text) throw new HttpError(400, 'Type a line to hear.');
  if (!/^[a-z0-9_]+$/.test(b.speaker || '')) throw new HttpError(400, 'Choose a voice.');
  if (b.lang && !/^[a-z]{2}-IN$/.test(b.lang)) throw new HttpError(400, 'Unknown language.');
  try {
    const mp3 = await sarvamSpeak(text, b.speaker, b.lang || 'en-IN', Number(b.pace) || 1);
    await logVoice(text.length);
    return Response.json({ audio: Buffer.from(mp3).toString('base64') });
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
});
