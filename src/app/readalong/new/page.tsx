'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api } from '@/lib/client';
import { ErrorNote, Loading, TopBar } from '@/components/ui';

function NewInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [title, setTitle] = useState(sp.get('title') || '');
  const [author, setAuthor] = useState(sp.get('author') || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    try {
      const r = await api<{ bookId: string }>('/api/readalong', { body: { title, author } });
      router.push(`/readalong/${r.bookId}?chapter=1`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <main className="page nonav">
      <TopBar back="/add" title="Read-along" />
      <h1 style={{ fontSize: 26 }}>I have it on paper</h1>
      <p style={{ margin: 0 }}>You read each chapter yourself, then tell SHRAVAN what you understood. SHRAVAN helps you put it in your own words, reflect and act on it.</p>
      <div className="note warn">SHRAVAN works only from your notes here. It does not have this book&apos;s text and will never claim to know what the book says.</div>
      <ErrorNote error={error} />
      <label className="col" style={{ gap: 6 }}>
        <span className="small muted">Book title</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="col" style={{ gap: 6 }}>
        <span className="small muted">Author (optional)</span>
        <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} />
      </label>
      <div className="grow" />
      <button className="btn" onClick={start} disabled={busy || !title.trim()}>
        {busy ? 'Starting…' : 'Start Read-along'}
      </button>
    </main>
  );
}

export default function NewReadAlong() {
  return (
    <Suspense fallback={<Loading />}>
      <NewInner />
    </Suspense>
  );
}
