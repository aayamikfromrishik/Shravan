// Admin: suggested books per section for a trial set.
import { handle } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';
import { trialPicks } from '@/lib/bulk';

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const per = Number(new URL(req.url).searchParams.get('per') || 3);
  return Response.json({ sections: await trialPicks(Math.min(Math.max(per, 1), 10)) });
});
