// Admin: lessons learners reported.
import { db, handle } from '@/lib/server';
import { requireAdmin } from '@/lib/admin';

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const { data } = await db()
    .from('chapter_versions')
    .select('id,mode,level,lang,part,flag_note,created_at,chapters(title,idx,books(title))')
    .eq('flagged', true)
    .order('created_at', { ascending: false })
    .limit(100);
  return Response.json({ flags: data || [] });
});
