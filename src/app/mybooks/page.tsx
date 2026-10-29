'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { BottomNav, ErrorNote, Icon, Loading } from '@/components/ui';

interface B {
  id: string;
  title: string;
  author: string | null;
  kind: string;
  uploaded: boolean;
  chapter: number;
}

export default function MyBooks() {
  const [books, setBooks] = useState<B[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ books: B[] }>('/api/mybooks')
      .then((r) => setBooks(r.books))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main className="page">
      <div className="row between">
        <h1 style={{ fontSize: 26 }}>My books</h1>
        <span className="row" style={{ gap: 8 }}>
          <Link href="/downloads" className="btn small ghost">
            Downloads
          </Link>
          <Link href="/add" className="btn small">
            <Icon name="plus" size={18} /> Add
          </Link>
        </span>
      </div>
      <ErrorNote error={error} />
      {!books && !error && <Loading />}
      {books?.length === 0 && (
        <div className="card col">
          <p style={{ margin: 0 }}>No books yet. Pick one from the library or add your own.</p>
          <Link href="/" className="btn">
            Go to the library
          </Link>
        </div>
      )}
      <div className="col">
        {books?.map((b) => (
          <Link key={b.id} href={b.kind === 'readalong' ? `/readalong/${b.id}?chapter=${b.chapter}` : `/book/${b.id}`} className="card row" style={{ textDecoration: 'none', color: 'var(--ink)', gap: 12 }}>
            <div aria-hidden style={{ width: 44, height: 60, borderRadius: 6, background: 'var(--hero)', flexShrink: 0 }} />
            <span className="col grow" style={{ gap: 2 }}>
              <b>{b.title}</b>
              <span className="small muted">
                {b.kind === 'readalong' ? 'Read-along' : b.uploaded ? 'Your upload' : 'Library'} · chapter {b.chapter}
              </span>
            </span>
          </Link>
        ))}
      </div>
      <BottomNav />
    </main>
  );
}
