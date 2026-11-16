'use client';
// Chapters heard in Drive mode whose questions are still waiting.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { BottomNav, ErrorNote, Loading, TopBar } from '@/components/ui';

interface Item {
  chapterId: string;
  idx: number;
  title: string;
  bookId: string | null;
  bookTitle: string;
}

export default function Pending() {
  const [d, setD] = useState<{ items: Item[]; max: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ items: Item[]; max: number }>('/api/pending')
      .then(setD)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="page">
      <TopBar back="/" title="Questions waiting" />
      <ErrorNote error={error} />
      {!d && !error && <Loading />}
      {d && d.items.length === 0 && (
        <div className="card col">
          <b>Nothing waiting.</b>
          <span className="small muted">Chapters you listen to in Drive mode appear here, so you can answer their questions when you are free.</span>
        </div>
      )}
      {d && d.items.length > 0 && (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            {d.items.length} of {d.max} chapters waiting. Drive mode pauses when {d.max} are waiting. Each takes about 2 minutes.
          </p>
          {d.items.map((it) => (
            <Link key={it.chapterId} href={`/learn/${it.chapterId}?step=reflect`} className="card row between" style={{ textDecoration: 'none', color: 'var(--ink)', gap: 8 }}>
              <span className="col" style={{ gap: 2 }}>
                <span className="tiny muted">{it.bookTitle}</span>
                <b className="small">
                  Chapter {it.idx}: {it.title}
                </b>
              </span>
              <span className="small">Answer</span>
            </Link>
          ))}
        </>
      )}
      <BottomNav />
    </main>
  );
}
