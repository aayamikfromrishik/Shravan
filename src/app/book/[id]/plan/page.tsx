'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { ErrorNote, Loading, TopBar } from '@/components/ui';

interface Plan {
  book_ideas: string[];
  suggestions: string[];
  revisit: string[];
  ticks?: Record<string, boolean>;
}

function TickList({ items, prefix, ticks, tick }: { items: string[]; prefix: string; ticks: Record<string, boolean>; tick: (k: string) => void }) {
  return (
    <>
      {items.map((t, i) => (
        <label key={i} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
          <input type="checkbox" checked={!!ticks[`${prefix}${i}`]} onChange={() => tick(`${prefix}${i}`)} style={{ marginTop: 4, width: 18, height: 18, accentColor: 'var(--primary)' }} />
          <span style={ticks[`${prefix}${i}`] ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{t}</span>
        </label>
      ))}
    </>
  );
}

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [title, setTitle] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticks, setTicks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api<{ book: { title: string }; plan: Plan | null }>(`/api/books/${id}/plan`)
      .then((r) => {
        setTitle(r.book.title);
        setPlan(r.plan);
        setLoaded(true);
        setTicks(r.plan?.ticks || {});
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ plan: Plan }>(`/api/books/${id}/plan`, { body: {} });
      setPlan(r.plan);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const tick = (k: string) => {
    const next = { ...ticks, [k]: !ticks[k] };
    setTicks(next);
    api(`/api/books/${id}/plan`, { body: { ticks: next } }).catch(() => {});
  };

  return (
    <main className="page nonav">
      <TopBar back={`/book/${id}`} right={<button className="btn small ghost" disabled title="Coming soon">Export · soon</button>} />
      <span className="label">Book finished</span>
      <h1 style={{ fontSize: 24 }}>Your action plan{title ? ` for ${title}` : ''}</h1>
      <ErrorNote error={error} />
      {!loaded && !error && <Loading />}
      {loaded && !plan && (
        <div className="card col">
          <p style={{ margin: 0 }}>Bring the important actions from every chapter you finished into one short plan.</p>
          <button className="btn" onClick={make} disabled={busy}>
            {busy ? 'Making your plan…' : 'Make my plan'}
          </button>
        </div>
      )}
      {plan && (
        <>
          {plan.book_ideas.length > 0 && (
            <section className="card col">
              <div className="row" style={{ gap: 8 }}>
                <h2 style={{ fontSize: 16 }}>The book&apos;s ideas</h2>
                <span className="chip book">From the book</span>
              </div>
              <TickList items={plan.book_ideas} prefix="b" ticks={ticks} tick={tick} />
            </section>
          )}
          {plan.suggestions.length > 0 && (
            <section className="card col">
              <div className="row" style={{ gap: 8 }}>
                <h2 style={{ fontSize: 16 }}>Your next steps</h2>
                <span className="chip">Suggested by SHRAVAN</span>
              </div>
              <TickList items={plan.suggestions} prefix="s" ticks={ticks} tick={tick} />
            </section>
          )}
          {plan.revisit.length > 0 && (
            <section className="note warn col" style={{ gap: 2 }}>
              <b>To revisit</b>
              {plan.revisit.map((r, i) => (
                <span key={i}>{r}</span>
              ))}
            </section>
          )}
          <button className="linkbtn" onClick={make} disabled={busy}>
            {busy ? 'Updating…' : 'Update the plan'}
          </button>
          <Link href="/actions" className="btn">
            Go to My actions
          </Link>
        </>
      )}
    </main>
  );
}
