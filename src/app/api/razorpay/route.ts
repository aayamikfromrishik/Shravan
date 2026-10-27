// Razorpay webhook: marks the learner as a subscriber while payments succeed.
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/lib/server';

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return new Response('Not configured', { status: 503 });
  const raw = await req.text();
  const sig = req.headers.get('x-razorpay-signature') || '';
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return new Response('Bad signature', { status: 400 });
  }
  const event = JSON.parse(raw);
  const sub = event?.payload?.subscription?.entity;
  const userId = sub?.notes?.user_id;
  if (!userId) return Response.json({ ok: true });
  if (['subscription.activated', 'subscription.charged', 'subscription.resumed'].includes(event.event)) {
    const until = sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null;
    await db().from('profiles').update({ plan: 'subscriber', subscribed_until: until }).eq('id', userId);
  }
  if (['subscription.cancelled', 'subscription.halted', 'subscription.completed'].includes(event.event)) {
    // Access continues until the paid period ends.
    const until = sub.current_end ? new Date(sub.current_end * 1000).toISOString() : new Date().toISOString();
    await db().from('profiles').update({ subscribed_until: until }).eq('id', userId);
  }
  return Response.json({ ok: true });
}
