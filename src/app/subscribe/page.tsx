'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/client';
import { useApp } from '@/components/AppProvider';
import { ErrorNote, TopBar } from '@/components/ui';

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

export default function Subscribe() {
  const { me, refresh } = useApp();
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const monthly = process.env.NEXT_PUBLIC_PRICE_MONTHLY;
  const yearly = process.env.NEXT_PUBLIC_PRICE_YEARLY;

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ subscriptionId: string; keyId: string; email: string }>('/api/subscribe', { body: { plan } });
      if (!window.Razorpay) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = () => res();
          s.onerror = () => rej(new Error('Could not load the payment window.'));
          document.body.appendChild(s);
        });
      }
      new window.Razorpay!({
        key: r.keyId,
        subscription_id: r.subscriptionId,
        name: 'SHRAVAN',
        description: `SHRAVAN ${plan} plan`,
        prefill: { email: r.email },
        handler: () => setTimeout(refresh, 3000),
      }).open();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page nonav">
      <TopBar back />
      <h1 style={{ fontSize: 26 }}>Carry on learning</h1>
      <p className="muted" style={{ margin: 0 }}>
        Your reflections and actions so far are saved.
      </p>
      <section className="card col">
        <span className="label">A subscription opens</span>
        <span>✓ Every chapter of every book</span>
        <span>✓ Ask about this chapter</span>
        <span>✓ Your end-of-book action plan</span>
        <span>✓ Export of your action summary (coming soon)</span>
      </section>
      {me?.isSubscriber ? (
        <div className="note good">You are a subscriber. Thank you.</div>
      ) : me?.paymentsEnabled ? (
        <>
          <div className="grid2">
            {(['monthly', 'yearly'] as const).map((p) => (
              <label key={p} className={`option ${plan === p ? 'on' : ''}`} style={{ flexDirection: 'column', gap: 4 }}>
                <span className="row between" style={{ width: '100%' }}>
                  <b>{p === 'monthly' ? 'Monthly' : 'Yearly'}</b>
                  <input type="radio" name="plan" checked={plan === p} onChange={() => setPlan(p)} style={{ marginTop: 0 }} />
                </span>
                <b style={{ fontSize: 20 }}>{(p === 'monthly' ? monthly : yearly) || '—'}</b>
                <span className="tiny muted">per {p === 'monthly' ? 'month' : 'year'}</span>
              </label>
            ))}
          </div>
          <ErrorNote error={error} />
          <button className="btn" onClick={pay} disabled={busy}>
            {busy ? 'Opening…' : 'Subscribe with UPI or card'}
          </button>
          <p className="center tiny muted" style={{ margin: 0 }}>
            Cancel any time. Payments by Razorpay.
          </p>
        </>
      ) : (
        <div className="note warn">Subscriptions open soon. Until then, enjoy the free part of up to 5 books, and any book made free for everyone.</div>
      )}
      <Link href="/" className="linkbtn center">
        Not now
      </Link>
    </main>
  );
}
