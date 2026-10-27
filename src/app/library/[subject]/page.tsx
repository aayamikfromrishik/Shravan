'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { api, daysLeft } from '@/lib/client';
import { SUBJECTS } from '@/lib/config';
import { BottomNav, ErrorNote, Loading, TopBar } from '@/components/ui';

interface LibBook {
  id: string;
  title: string;
  author: string | null;
  edition: string | null;
  needs_own_copy: boolean;
  buy_url: string | null;
  free_until: string | null;
  published: boolean;
  status: string;
}

export default function LibraryPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = use(params);
  const name = SUBJECTS.find((s) => s.id === subject)?.name || 'Library';
  const [books, setBooks] = useState<LibBook[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ books: LibBook[] }>(`/api/library?subject=${subject}`)
      .then((r) => setBooks(r.books))
      .catch((e) => setError(e.message));
  }, [subject]);

  return (
    <main className="page">
      <TopBar back="/" title="Library" />
      <h1 style={{ fontSize: 26 }}>{name}</h1>
      {subject === 'spiritual' && <p className="muted small" style={{ margin: 0 }}>Taught respectfully and neutrally. The translation used is always shown.</p>}
      {subject === 'business' && <p className="muted small" style={{ margin: 0 }}>Modern books: learn from your own copy (PDF or EPUB), or with Read-along if you have it on paper.</p>}
      <ErrorNote error={error} />
      {!books && !error && <Loading />}
      {books?.length === 0 && <p className="muted">No books here yet.</p>}
      <div className="col">
        {books?.map((b) => {
          const free = b.free_until && new Date(b.free_until) > new Date();
          return (
            <Link key={b.id} href={`/book/${b.id}`} className="card" style={{ textDecoration: 'none', color: 'var(--ink)', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div aria-hidden style={{ width: 52, height: 72, borderRadius: 6, background: 'var(--hero)', flexShrink: 0, display: 'flex', alignItems: 'flex-end', padding: 6 }}>
                <div style={{ height: 3, width: 20, background: 'var(--accent)' }} />
              </div>
              <div className="col grow" style={{ gap: 2 }}>
                <b style={{ fontSize: 16 }}>{b.title}</b>
                <span className="small muted">
                  {b.author}
                  {b.edition ? ` · ${b.edition}` : ''}
                </span>
                <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {free && <span className="chip gold">Free for {daysLeft(b.free_until!)} days</span>}
                  {b.needs_own_copy && <span className="chip">Your own copy</span>}
                  {!b.published && <span className="chip warn">Not published</span>}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      <BottomNav />
    </main>
  );
}
