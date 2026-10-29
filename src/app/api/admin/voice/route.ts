// Admin: narrator voice settings.
import { body, handle, HttpError } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';
import { getVoiceSettings, INR_PER_10K_CHARS, sarvamReady, saveVoiceSettings, VOICE_SUGGESTIONS, voiceSpentThisMonthInr, type VoiceSettings } from '@/lib/voice';

export const GET = handle(async (req) => {
  await requireAdmin(req);
  return Response.json({
    settings: await getVoiceSettings(),
    suggestions: VOICE_SUGGESTIONS,
    keySet: sarvamReady(),
    spentThisMonthInr: Math.round((await voiceSpentThisMonthInr()) * 100) / 100,
    inrPer10kChars: INR_PER_10K_CHARS,
  });
});

export const PUT = handle(async (req) => {
  await requireAdmin(req);
  const b = await body<VoiceSettings>(req);
  const cur = await getVoiceSettings();
  const pace = Number(b.pace);
  const budget = Number(b.budgetInr);
  if (!(pace >= 0.5 && pace <= 2)) throw new HttpError(400, 'Speed must be between 0.5 and 2.');
  if (!(budget >= 0)) throw new HttpError(400, 'Budget must be 0 or more.');
  const voices = { ...cur.voices };
  for (const k of Object.keys(voices) as (keyof VoiceSettings['voices'])[]) {
    const v = String(b.voices?.[k] ?? '').trim();
    if (v) {
      if (!/^[a-z0-9_]+$/.test(v)) throw new HttpError(400, `"${v}" is not a valid voice name.`);
      voices[k] = v;
    }
  }
  await saveVoiceSettings({ enabled: !!b.enabled, budgetInr: budget, pace, voices });
  return Response.json({ ok: true });
});
