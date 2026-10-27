// Start a Razorpay subscription. Switched off until PAYMENTS_ENABLED=true (after GST is settled).
import { body, getCaller, handle, HttpError } from '@/lib/server';
import { PAYMENTS_ENABLED } from '@/lib/config';

export const POST = handle(async (req) => {
  const c = await getCaller(req);
  if (!PAYMENTS_ENABLED) throw new HttpError(503, 'Subscriptions open soon.');
  const b = await body<{ plan: 'monthly' | 'yearly' }>(req);
  const planId = b.plan === 'yearly' ? process.env.RAZORPAY_PLAN_YEARLY : process.env.RAZORPAY_PLAN_MONTHLY;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!planId || !keyId || !secret) throw new HttpError(503, 'Payments are not set up yet.');
  const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${keyId}:${secret}`).toString('base64') },
    body: JSON.stringify({ plan_id: planId, total_count: b.plan === 'yearly' ? 10 : 120, customer_notify: 1, notes: { user_id: c.user.id } }),
  });
  if (!res.ok) throw new HttpError(502, 'Could not start the payment. Please try again.');
  const sub = await res.json();
  return Response.json({ subscriptionId: sub.id, keyId, email: c.user.email });
});
