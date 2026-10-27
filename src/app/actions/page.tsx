'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { BottomNav, ErrorNote, Loading } from '@/components/ui';

interface A {
  id: string;
  text: string;
  source: 'book' | 'shravan';
  is_first: boolean;
  done: boolean;
  book_id: string;
  books: { title: string } | null;
  chapters: { title: string; idx: number } | null;
}

export default function ActionsPage() {
  const [list, setList] = useState<A[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  useEffect(() => {
    api<{ actions: A[] }>('/api/actions')
      .then((r) => setList(r.actions))
      .catch((e) => setError(e.message));
  }, []);

  const toggle = async (a: A) => {
    setList((l) => l?.map((x) => (x.id === a.id ? { ...x, done: !x.done } : x)) || null);
    await api(`/api/actions/${a.id}`, { method: 'PATCH', body: { done: !a.done } }).catch(() => {});
  };

  const visible = (list || []).filter((a) => showDone || !a.done);
  const groups = new Map<string, A[]>();
  for (const a of visible) {
    const k = a.books?.title || 'Book';
    groups.set(k, [...(groups.get(k) || []), a]);
  }

  return (
    <main className="page">
      <h1 style={{ fontSize: 26 }}>My actions</h1>
      <ErrorNote error={error} />
      {!list && !error && <Loading />}
      {list?.length === 0 && <p className="muted">Actions appear here after you finish a chapter&apos;s Apply step.</p>}
      {[...groups].map(([title, items]) => (
        <section key={title} className="card col">
          <div className="row between">
            <b>{title}</b>
            <Link href={`/book/${items[0].book_id}/plan`} className="small">
              Plan
            </Link>
          </div>
          {items.map((a) => (
            <label key={a.id} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <input type="checkbox" checked={a.done} onChange={() => toggle(a)} style={{ marginTop: 4, width: 20, height: 20, accentColor: 'var(--primary)' }} />
              <span className="col" style={{ gap: 2 }}>
                <span style={a.done ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>{a.text}</span>
                <span className="tiny muted">
                  {a.is_first ? 'First action · ' : ''}
                  {a.source === 'book' ? 'From the book' : 'Suggested by SHRAVAN'}
                  {a.chapters ? ` · chapter ${a.chapters.idx}` : ''}
                </span>
              </span>
            </label>
          ))}
        </section>
      ))}
      {list && list.some((a) => a.done) && (
        <button className="linkbtn" onClick={() => setShowDone(!showDone)}>
          {showDone ? 'Hide finished actions' : 'Show finished actions'}
        </button>
      )}
      <BottomNav />
    </main>
  );
}
