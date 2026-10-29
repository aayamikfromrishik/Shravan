// The AI narrator (Sarvam Bulbul). Each lesson version is narrated once, saved, and reused by everyone.
// Server only.
import { db } from './server';
import { putObject, objectUrl, removeObjects } from './files';
import { lessonSpeech, toSentences, type Lesson } from './lesson';
import type { Lang } from './config';
import { VOICE_CATALOG } from './voices-catalog';

export const SARVAM_MODEL = 'bulbul:v4-flash';
export const INR_PER_10K_CHARS = Number(process.env.VOICE_INR_PER_10K || 10);
const MAX_CHARS = 2000; // Sarvam allows 2,500 per request; smaller parts start playing sooner

export interface VoiceSettings {
  enabled: boolean;
  budgetInr: number; // per calendar month; 0 = no limit
  pace: number;
  voices: { english: string; hindi: string; mix: string; spiritual_english: string; spiritual_hindi: string };
}

export const DEFAULT_VOICE: VoiceSettings = {
  enabled: true,
  budgetInr: 1000,
  pace: 1,
  voices: {
    english: 'shubh_en_narration_gentle',
    hindi: 'roopa_hi_narration',
    mix: 'simran_enhi_companion',
    spiritual_english: 'shubh_en_narration_gentle',
    spiritual_hindi: 'shubh_hi_devotional',
  },
};

/** Voices suggested in Admin: Sarvam's full catalogue. Any valid Sarvam voice name also works. */
export const VOICE_SUGGESTIONS = Object.values(VOICE_CATALOG).flatMap((l) => l.voices);

export const sarvamReady = () => !!process.env.SARVAM_API_KEY?.trim();

export async function getVoiceSettings(): Promise<VoiceSettings> {
  const { data } = await db().from('app_settings').select('value').eq('key', 'voice').maybeSingle();
  const v = (data?.value || {}) as Partial<VoiceSettings>;
  return { ...DEFAULT_VOICE, ...v, voices: { ...DEFAULT_VOICE.voices, ...(v.voices || {}) } };
}

export async function saveVoiceSettings(v: VoiceSettings) {
  await db().from('app_settings').upsert({ key: 'voice', value: v, updated_at: new Date().toISOString() });
}

export function pickVoice(s: VoiceSettings, lang: Lang, subject: string | null): { speaker: string; languageCode: string } {
  const spiritual = subject === 'spiritual';
  if (lang === 'hindi') return { speaker: spiritual ? s.voices.spiritual_hindi : s.voices.hindi, languageCode: 'hi-IN' };
  if (lang === 'mix') return { speaker: s.voices.mix, languageCode: 'hi-IN' };
  return { speaker: spiritual ? s.voices.spiritual_english : s.voices.english, languageCode: 'en-IN' };
}

/** Group sentences into parts Sarvam can read in one go, keeping sentence numbers for the player. */
export function splitParts(sentences: string[]): { start: number; end: number; text: string }[] {
  const parts: { start: number; end: number; text: string }[] = [];
  let start = 0;
  let text = '';
  sentences.forEach((raw, i) => {
    const s = raw.length > MAX_CHARS ? raw.slice(0, MAX_CHARS) : raw;
    if (text && text.length + 1 + s.length > MAX_CHARS) {
      parts.push({ start, end: i - 1, text });
      start = i;
      text = '';
    }
    text = text ? `${text} ${s}` : s;
  });
  if (text) parts.push({ start, end: sentences.length - 1, text });
  return parts;
}

/** One Sarvam request: text in, MP3 bytes out. */
export async function sarvamSpeak(text: string, speaker: string, languageCode: string, pace = 1): Promise<Uint8Array> {
  const key = process.env.SARVAM_API_KEY?.trim();
  if (!key) throw new Error('SARVAM_API_KEY is not set in Vercel.');
  const call = (lang: string) =>
    fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language_code: lang, speaker, model: SARVAM_MODEL, pace, speech_sample_rate: 24000, output_audio_codec: 'mp3' }),
    });
  let res = await call(languageCode);
  // A mixed-language voice may expect the other language code; try once more.
  if (res.status === 400 && speaker.includes('_enhi_')) res = await call(languageCode === 'hi-IN' ? 'en-IN' : 'hi-IN');
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await call(languageCode);
  }
  if (!res.ok) {
    const body = await res.text();
    let msg = body.slice(0, 200);
    try {
      msg = JSON.parse(body)?.error?.message || msg;
    } catch {}
    throw new Error(`Sarvam ${res.status}: ${msg}`);
  }
  const json = (await res.json()) as { audios?: string[] };
  const b64 = json.audios?.[0];
  if (!b64) throw new Error('Sarvam returned no audio.');
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

export async function logVoice(chars: number) {
  await db().from('usage_log').insert({ kind: 'voice', chars });
}

export async function voiceSpentThisMonthInr(): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await db().from('usage_log').select('chars').eq('kind', 'voice').gte('created_at', start.toISOString()).limit(50000);
  const chars = (data || []).reduce((a, r) => a + (r.chars || 0), 0);
  return (chars / 10000) * INR_PER_10K_CHARS;
}

export interface AudioPart {
  url: string;
  start: number;
  end: number;
  chars: number;
}
export type AudioResult =
  | { status: 'ready'; parts: AudioPart[]; voice: string }
  | { status: 'generating' }
  | { status: 'off' | 'budget' | 'failed'; reason: string };

const STALE_MS = 4 * 60 * 1000;

async function withUrls(parts: { store: string; key: string; start: number; end: number; chars: number }[]): Promise<AudioPart[]> {
  return Promise.all(parts.map(async (p) => ({ url: await objectUrl(p.store, p.key), start: p.start, end: p.end, chars: p.chars })));
}

/** Get the narration for a lesson version, or make it now (only the first listener waits). */
export async function getOrCreateAudio(args: { versionId: string; lesson: Lesson; lang: Lang; subject: string | null }): Promise<AudioResult> {
  if (!sarvamReady()) return { status: 'off', reason: 'The narrator voice is not set up yet.' };
  const settings = await getVoiceSettings();
  if (!settings.enabled) return { status: 'off', reason: 'The narrator voice is switched off.' };

  const { speaker, languageCode } = pickVoice(settings, args.lang, args.subject);
  const voice = `${speaker}@${settings.pace}`;
  const sb = db();
  const { data: found } = await sb.from('lesson_audio').select('*').eq('version_id', args.versionId).eq('voice', voice).maybeSingle();
  if (found?.status === 'ready') return { status: 'ready', parts: await withUrls(found.parts), voice };
  if (found?.status === 'generating' && Date.now() - new Date(found.created_at).getTime() < STALE_MS) return { status: 'generating' };

  if (settings.budgetInr > 0 && (await voiceSpentThisMonthInr()) >= settings.budgetInr) {
    return { status: 'budget', reason: "This month's narrator budget is used up." };
  }

  // Claim the job so two listeners don't pay for the same audio.
  let rowId = found?.id as string | undefined;
  if (found) {
    await sb.from('lesson_audio').update({ status: 'generating', error: null, created_at: new Date().toISOString() }).eq('id', found.id);
  } else {
    const { data: claimed, error } = await sb.from('lesson_audio').insert({ version_id: args.versionId, voice, status: 'generating' }).select('id').single();
    if (error) return { status: 'generating' };
    rowId = claimed.id;
  }

  const sentences = toSentences(lessonSpeech(args.lesson, args.lang));
  const parts = splitParts(sentences);
  try {
    const saved: { store: string; key: string; start: number; end: number; chars: number }[] = new Array(parts.length);
    // A few parts at a time keeps within Sarvam's rate limits.
    for (let i = 0; i < parts.length; i += 4) {
      await Promise.all(
        parts.slice(i, i + 4).map(async (p, j) => {
          const n = i + j;
          const mp3 = await sarvamSpeak(p.text, speaker, languageCode, settings.pace);
          const key = `audio/${args.versionId}/${voice.replace(/[^\w.@-]/g, '')}/${String(n).padStart(3, '0')}.mp3`;
          const store = await putObject(key, mp3, 'audio/mpeg');
          saved[n] = { store, key, start: p.start, end: p.end, chars: p.text.length };
        }),
      );
    }
    const chars = parts.reduce((a, p) => a + p.text.length, 0);
    await sb.from('lesson_audio').update({ status: 'ready', parts: saved, chars }).eq('id', rowId);
    await logVoice(chars);
    return { status: 'ready', parts: await withUrls(saved), voice };
  } catch (e) {
    console.error('narration failed', e);
    await sb.from('lesson_audio').update({ status: 'failed', error: String((e as Error).message).slice(0, 300) }).eq('id', rowId);
    return { status: 'failed', reason: (e as Error).message };
  }
}

/** Remove saved narration of a lesson version (when the lesson is rewritten). */
export async function removeVersionAudio(versionId: string) {
  const { data } = await db().from('lesson_audio').select('parts').eq('version_id', versionId);
  const items = (data || []).flatMap((r) => (r.parts || []) as { store: string; key: string }[]);
  await removeObjects(items);
  await db().from('lesson_audio').delete().eq('version_id', versionId);
}
