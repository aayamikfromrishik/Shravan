import { body, db, getCaller, handle, isSubscriber } from '@/lib/server';
import { LIMITS, PAYMENTS_ENABLED } from '@/lib/config';
import { getVoiceSettings, sarvamReady } from '@/lib/voice';

export const GET = handle(async (req) => {
  const c = await getCaller(req);
  const { count: used } = await db().from('free_previews').select('*', { count: 'exact', head: true }).eq('user_id', c.user.id);
  const { count: unread } = await db()
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .or(`user_id.is.null,user_id.eq.${c.user.id}`)
    .gt('created_at', c.profile.notifications_seen_at);
  return Response.json({
    profile: c.profile,
    isAdmin: c.isAdmin,
    isSubscriber: isSubscriber(c.profile),
    previewsLeft: Math.max(0, LIMITS.freePreviewBooks - (used || 0)),
    unread: unread || 0,
    paymentsEnabled: PAYMENTS_ENABLED,
    aiVoice: sarvamReady() && (await getVoiceSettings().catch(() => ({ enabled: false }))).enabled,
  });
});

export const PATCH = handle(async (req) => {
  const c = await getCaller(req);
  const b = await body<Record<string, string>>(req);
  const allowed: Record<string, string[]> = {
    view: ['basic', 'peacock'],
    default_language: ['english', 'hindi', 'mix'],
    default_level: ['basic', 'normal', 'advanced'],
    default_mode: ['key', 'examples', 'complete'],
  };
  const patch: Record<string, string> = {};
  for (const [k, v] of Object.entries(b)) if (allowed[k]?.includes(v)) patch[k] = v;
  if (typeof b.name === 'string') patch.name = b.name.slice(0, 80);
  if (b.notifications_seen === 'now') patch.notifications_seen_at = new Date().toISOString();
  if (Object.keys(patch).length) await db().from('profiles').update(patch).eq('id', c.user.id);
  return Response.json({ ok: true });
});

/** Delete my journal: every reflection answer, for good. */
export const DELETE = handle(async (req) => {
  const c = await getCaller(req);
  await db().from('reflections').delete().eq('user_id', c.user.id);
  await db().from('readalong_turns').delete().eq('user_id', c.user.id);
  return Response.json({ ok: true });
});
