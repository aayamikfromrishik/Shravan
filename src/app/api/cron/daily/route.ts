// Runs once a day (vercel.json): reminds learners one day before a free book goes back to paid.
import { db } from '@/lib/server';
import { formatDate, notify } from '@/lib/notify';

export async function GET(req: Request) {
  if (process.env.CRON_SECRET && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const now = Date.now();
  const { data } = await db()
    .from('books')
    .select('id,title,free_until')
    .eq('free_reminder_sent', false)
    .gt('free_until', new Date(now).toISOString())
    .lt('free_until', new Date(now + 36 * 3600 * 1000).toISOString());
  for (const b of data || []) {
    await notify({
      title: `Last day: ${b.title} is free`,
      body: `Free for everyone until ${formatDate(new Date(b.free_until))}. Chapters you finish stay yours.`,
      link: `/book/${b.id}`,
      bookId: b.id,
    });
    await db().from('books').update({ free_reminder_sent: true }).eq('id', b.id);
  }
  return Response.json({ reminded: data?.length || 0 });
}
