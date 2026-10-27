// Save this phone for notifications (book made free, reminders).
import { body, db, getCaller, handle, HttpError } from '@/lib/server';

export const POST = handle(async (req) => {
  const c = await getCaller(req);
  const b = await body<{ subscription: { endpoint: string } }>(req);
  if (!b.subscription?.endpoint) throw new HttpError(400, 'Missing subscription.');
  await db().from('push_subscriptions').upsert({ endpoint: b.subscription.endpoint, user_id: c.user.id, subscription: b.subscription });
  return Response.json({ ok: true });
});
