// Admin: checks that every connected service works. Shows only yes/no, never the secret values.
import { db, handle } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';
import { pingClaude } from '@/lib/ai';
import { checkR2, r2Ready } from '@/lib/files';
import { sarvamReady, sarvamSpeak, getVoiceSettings } from '@/lib/voice';
import { adminEmails } from '@/lib/config';

export const maxDuration = 60;

interface Check { name: string; ok: boolean | null; note: string }

async function run(name: string, fn: () => Promise<string>): Promise<Check> {
  try {
    return { name, ok: true, note: await fn() };
  } catch (e) {
    return { name, ok: false, note: (e as Error).message?.slice(0, 240) || 'failed' };
  }
}

export const GET = handle(async (req) => {
  const c = await requireAdmin(req);
  const sb = db();
  const env = (k: string) => !!process.env[k]?.trim();

  const checks: Check[] = await Promise.all([
    run('Database (Supabase)', async () => {
      const { count, error } = await sb.from('books').select('*', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      return `connected; ${count ?? 0} books`;
    }),
    run('Kept-files table (update 2)', async () => {
      const { error: missing } = await sb.from('book_files').select('id').limit(1);
      if (missing) throw new Error('Not found. Run supabase/migrations/002_keep_files.sql in Supabase → SQL Editor.');
      const { count } = await sb.from('book_files').select('*', { count: 'exact', head: true });
      return `ready; ${count ?? 0} files kept`;
    }),
    run('Upload storage (Supabase)', async () => {
      const a = await sb.storage.getBucket('uploads');
      if (a.error) throw new Error('Bucket "uploads" missing: run schema.sql again.');
      // Kept files go to Cloudflare R2 when it is connected; the "files" bucket is only a fallback.
      if (r2Ready()) return 'bucket "uploads" exists; kept files go to Cloudflare R2';
      const b = await sb.storage.getBucket('files');
      if (b.error) throw new Error('Bucket "files" missing: run 002_keep_files.sql.');
      return 'buckets "uploads" and "files" exist';
    }),
    run('Cloudflare R2', checkR2),
    run('Claude API', async () => `key works, credit available (${await pingClaude()})`),
    run('Narrator voice (Sarvam)', async () => {
      if (!sarvamReady()) throw new Error('SARVAM_API_KEY is not set in Vercel.');
      const s = await getVoiceSettings();
      const mp3 = await sarvamSpeak('Namaste.', s.voices.english, 'en-IN');
      return `key works (${Math.round(mp3.byteLength / 1024)} KB test clip); narrator ${s.enabled ? 'ON' : 'off'}`;
    }),
    run('Voice database (update 3)', async () => {
      const { error } = await sb.from('lesson_audio').select('id').limit(1);
      if (error) throw new Error('Not found. Run supabase/migrations/003_voice.sql in Supabase → SQL Editor.');
      return 'ready';
    }),
    run('Admin email', async () => {
      const list = adminEmails();
      if (!list.length) throw new Error('ADMIN_EMAILS is empty in Vercel.');
      return list.includes((c.user.email || '').toLowerCase()) ? `you are listed (${list.length} admin${list.length > 1 ? 's' : ''})` : 'set';
    }),
    run('Daily scheduled check', async () => {
      if (!env('CRON_SECRET')) throw new Error('CRON_SECRET is not set in Vercel.');
      return 'secret set';
    }),
  ]);

  const { count: published } = await sb.from('books').select('*', { count: 'exact', head: true }).eq('is_library', true).eq('published', true);
  const { count: samples } = await sb.from('chapter_versions').select('*', { count: 'exact', head: true }).eq('is_sample', true);
  checks.push(
    { name: 'Library', ok: (published ?? 0) > 0, note: `${published ?? 0} published books; ${samples ?? 0} sample lessons attached (expected 18)` },
    { name: 'Phone notifications', ok: env('NEXT_PUBLIC_VAPID_PUBLIC_KEY') && env('VAPID_PRIVATE_KEY') ? true : null, note: env('VAPID_PRIVATE_KEY') ? 'keys set' : 'not set up yet (optional for now)' },
    { name: 'Payments', ok: null, note: process.env.PAYMENTS_ENABLED === 'true' ? 'ON' : 'off (as planned until GST is settled)' },
    { name: 'Learner downloads', ok: null, note: process.env.LEARNER_DOWNLOADS === 'true' ? 'ON' : 'off (admin can always download)' },
  );
  return Response.json({ checks });
});
