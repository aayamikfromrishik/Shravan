// In-app notices + phone notifications (Web Push). Server only.
import webpush from 'web-push';
import { db } from './server';

let configured = false;
function setup(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@aayamik.com', pub, priv);
  configured = true;
  return true;
}

/** Notice for everyone (userId null) or one learner; also sends phone notifications where allowed. */
export async function notify(n: { title: string; body: string; link?: string; bookId?: string; userId?: string | null }) {
  await db().from('notifications').insert({ title: n.title, body: n.body, link: n.link ?? null, book_id: n.bookId ?? null, user_id: n.userId ?? null });
  if (!setup()) return;
  let q = db().from('push_subscriptions').select('endpoint,subscription');
  if (n.userId) q = q.eq('user_id', n.userId);
  const { data } = await q;
  const payload = JSON.stringify({ title: n.title, body: n.body, link: n.link || '/' });
  await Promise.all(
    (data || []).map(async (s) => {
      try {
        await webpush.sendNotification(s.subscription, payload);
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db().from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      }
    }),
  );
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
}
