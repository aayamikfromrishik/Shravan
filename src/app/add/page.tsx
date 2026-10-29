'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { api, uploadBook } from '@/lib/client';
import { useApp } from '@/components/AppProvider';
import { BottomNav, ErrorNote, Icon, Loading, TopBar } from '@/components/ui';

function AddInner() {
  const { me } = useApp();
  const router = useRouter();
  const sp = useSearchParams();
  const libraryBookId = sp.get('for') || undefined; // uploading my copy of a library "own copy" title
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState<{ status: string; note: string } | null>(null);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setDeclined(null);
    try {
      setBusy('Uploading…');
      const { path } = await uploadBook(f);
      setBusy('Reading the book and finding chapters…');
      const r = await api<{ ok: boolean; bookId?: string; status?: string; note?: string }>('/api/uploads/process', { body: { path, fileName: f.name, libraryBookId } });
      if (!r.ok) setDeclined({ status: r.status || 'failed', note: r.note || 'This file could not be read.' });
      else router.push(`/book/${r.bookId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <main className="page">
      <TopBar back="/" title={me && !me.isSubscriber && !me.isAdmin ? `${me.previewsLeft} of 5 free previews left` : 'Add a book'} />
      <h1 style={{ fontSize: 26 }}>Add a book</h1>
      <ErrorNote error={error} />
      {declined && (
        <div className="card col">
          <span className="chip bad" style={{ alignSelf: 'flex-start' }}>
            {declined.status === 'scanned' ? 'Scanned book' : declined.status === 'locked' ? 'Locked file' : declined.status === 'too_big' ? 'Too big for the beta' : 'Could not read'}
          </span>
          <p style={{ margin: 0 }}>{declined.note}</p>
          <p className="small muted" style={{ margin: 0 }}>
            This didn&apos;t use one of your free previews.
          </p>
          <Link href="/readalong/new" className="btn outline">
            Use Read-along instead
          </Link>
        </div>
      )}

      <section className="card col" style={{ borderWidth: 2, borderColor: 'var(--primary)', gap: 12 }}>
        <div className="row" style={{ gap: 12 }}>
          <Icon name="upload" size={34} />
          <div className="col" style={{ gap: 0 }}>
            <b style={{ fontSize: 18 }}>Upload your book</b>
            <span className="small muted">PDF or EPUB, for your own study</span>
          </div>
        </div>
        {busy ? (
          <Loading text={busy} />
        ) : (
          <>
            <input ref={fileRef} type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" className="sr" id="file" onChange={(e) => onFile(e.target.files?.[0])} />
            <label htmlFor="file" className="btn" style={{ cursor: 'pointer' }}>
              Choose a file
            </label>
          </>
        )}
        <span className="tiny muted">Text files only · up to 30 MB · up to 1,000 pages</span>
        <div className="note warn">Books bought on Kindle, Google Play or Apple Books are locked and can&apos;t be uploaded. Use Read-along for those.</div>
      </section>

      <Link href="/" className="card row" style={{ textDecoration: 'none', color: 'var(--ink)', gap: 12 }}>
        <Icon name="library" size={28} />
        <span className="col grow" style={{ gap: 0 }}>
          <b>Pick from the library</b>
          <span className="small muted">Classics and scriptures, ready to learn</span>
        </span>
      </Link>
      <Link href="/readalong/new" className="card row" style={{ textDecoration: 'none', color: 'var(--ink)', gap: 12 }}>
        <Icon name="paper" size={28} />
        <span className="col grow" style={{ gap: 0 }}>
          <b>I have it on paper</b>
          <span className="small muted">Read-along: you read, SHRAVAN helps you apply it</span>
        </span>
      </Link>
      <p className="center muted small" style={{ margin: 0 }}>
        Every book starts with a free part: chapter 1, up to 7 pages. Your uploads stay private to you.
      </p>
      <BottomNav />
    </main>
  );
}

export default function AddPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AddInner />
    </Suspense>
  );
}
