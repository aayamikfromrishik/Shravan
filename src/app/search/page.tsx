'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { BottomNav, ErrorNote, Loading, TopBar } from '@/components/ui';
import MicButton from '@/components/MicButton';

interface R {
  books: { id: string; title: string; author: string | null; kind: string }[];
  sections: { chapterId: string; bookId: string; bookTitle: string; chapterTitle: string; idx: number; snippet: string }[];
}

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [r, setR] = useState<R | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setR(null);
      return;
    }
    const t = setTimeout(() => {
      setBusy(true);
      api<R>(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then(setR)
        .catch((e) => setError(e.message))
        .finally(() => setBusy(false));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <main className="page">
      <TopBar back="/" />
      <div className="row">
        <label className="grow">
          <span className="sr">Search books and topics</span>
          <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="A book, an author or a topic (anger, money…)" />
        </label>
        <MicButton lang="english" onText={setQ} label="Search by voice" />
      </div>
      <ErrorNote error={error} />
      {busy && <Loading text="Searching…" />}
      {r && !busy && (
        <>
          {r.books.length > 0 && (
            <section className="col">
              <span className="label">Books</span>
              {r.books.map((b) => (
                <Link key={b.id} href={b.kind === 'readalong' ? `/readalong/${b.id}` : `/book/${b.id}`} className="card" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                  <b>{b.title}</b>
                  {b.author && <div className="small muted">{b.author}</div>}
                </Link>
              ))}
            </section>
          )}
          {r.sections.length > 0 && (
            <section className="col">
              <span className="label">Sections about this topic</span>
              {r.sections.map((s) => (
                <Link key={s.chapterId} href={`/learn/${s.chapterId}`} className="card col" style={{ textDecoration: 'none', color: 'var(--ink)', gap: 2, borderLeft: '4px solid var(--primary)' }}>
                  <b>
                    {s.bookTitle} · {s.chapterTitle}
                  </b>
                  <span className="small muted">{s.snippet}</span>
                  <span className="small" style={{ color: 'var(--link)', fontWeight: 600 }}>
                    Start from here
                  </span>
                </Link>
              ))}
            </section>
          )}
          {r.books.length === 0 && r.sections.length === 0 && <p className="muted">Nothing found.</p>}
          <section className="card col" style={{ borderStyle: 'dashed' }}>
            <span className="label">Not in the library?</span>
            <p style={{ margin: 0 }}>Upload your own copy as a PDF or EPUB, or use Read-along if you have it on paper.</p>
            <Link href="/add" className="btn">
              Add a book
            </Link>
          </section>
          <p className="center muted tiny" style={{ margin: 0 }}>
            Results come only from the books&apos; real text.
          </p>
        </>
      )}
      <BottomNav />
    </main>
  );
}
