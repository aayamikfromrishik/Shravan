'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { api, daysLeft, downloadBookFile, fmtDate } from '@/lib/client';
import { useApp } from '@/components/AppProvider';
import { BottomNav, ErrorNote, Icon, Loading, TopBar } from '@/components/ui';

interface BookResp {
  book: {
    id: string;
    title: string;
    author: string | null;
    edition: string | null;
    subject: string | null;
    kind: string;
    status: string;
    status_note: string | null;
    free_until: string | null;
    free_now: boolean;
    is_library: boolean;
    needs_own_copy: boolean;
    buy_url: string | null;
    page_count: number | null;
    source_type: string | null;
    uploaded_by_me: boolean;
    can_edit_chapters: boolean;
  };
  source: { textWords: number; taughtWords: number; chapters: number; freePartWords: number; freePartIsWholeChapter: boolean; freePartPages: number };
  chapters: { id: string; idx: number; title: string; words: number; pages: string | null; completed: boolean; open: boolean }[];
  settings: { mode: string; level: string; lang: string; current_chapter: number } | null;
  firstAccess: string;
  previewsLeft: number;
  fullAccess: boolean;
}

export default function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useApp();
  const [d, setD] = useState<BookResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [hasFile, setHasFile] = useState(false);

  const load = useCallback(() => {
    api<BookResp>(`/api/books/${id}`)
      .then(setD)
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => {
    api<{ files: unknown[] }>(`/api/books/${id}/files`)
      .then((r) => setHasFile(r.files.length > 0))
      .catch(() => setHasFile(false));
  }, [id]);

  if (error) return <main className="page"><TopBar back="/" /><ErrorNote error={error} /><BottomNav /></main>;
  if (!d) return <main className="page"><TopBar back="/" /><Loading /><BottomNav /></main>;
  const { book, source, chapters } = d;

  if (book.kind === 'readalong') {
    return (
      <main className="page">
        <TopBar back="/mybooks" title="Read-along" />
        <h1 style={{ fontSize: 26 }}>{book.title}</h1>
        <Link className="btn" href={`/readalong/${book.id}?chapter=${d.settings?.current_chapter || 1}`}>
          Continue Read-along
        </Link>
        <BottomNav />
      </main>
    );
  }

  const ownCopy = book.needs_own_copy;
  const statusChip =
    book.status === 'ready' ? (
      <span className="chip good">Text readable</span>
    ) : book.status === 'no_text' ? (
      <span className="chip warn">No text in SHRAVAN</span>
    ) : (
      <span className="chip bad">Not readable</span>
    );
  const pct = source.textWords ? Math.round((source.taughtWords / source.textWords) * 100) : 0;
  const nextIdx = d.settings?.current_chapter || 1;
  const next = chapters.find((c) => c.idx === nextIdx) || chapters[0];
  const allDone = chapters.length > 0 && chapters.every((c) => c.completed);

  const rename = async (idx: number, title: string) => {
    const t = prompt('Chapter title', title);
    if (!t) return;
    await api(`/api/books/${id}/chapters`, { method: 'PATCH', body: { action: 'rename', idx, title: t } }).catch((e) => setError(e.message));
    load();
  };
  const merge = async (idx: number) => {
    if (!confirm(`Join chapter ${idx} with chapter ${idx + 1}?`)) return;
    await api(`/api/books/${id}/chapters`, { method: 'PATCH', body: { action: 'merge_next', idx } }).catch((e) => setError(e.message));
    load();
  };

  return (
    <main className="page">
      <TopBar back={book.is_library && book.subject ? `/library/${book.subject}` : '/mybooks'} title={book.is_library ? 'Library' : 'Your book'} />

      <div className="row" style={{ gap: 16, alignItems: 'center' }}>
        <div aria-hidden style={{ width: 78, height: 108, borderRadius: 8, background: 'var(--hero)', flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 10, border: '1px solid var(--border)' }}>
          <div style={{ height: 3, width: 26, background: 'var(--accent)' }} />
          <span style={{ fontSize: 11, color: 'var(--hero-ink)', fontWeight: 600, lineHeight: 1.2 }}>{book.title}</span>
        </div>
        <div className="col" style={{ gap: 2 }}>
          <h1 style={{ fontSize: 25 }}>{book.title}</h1>
          {book.author && <span>{book.author}</span>}
          {book.edition && <span className="small muted">{book.edition}</span>}
          {book.uploaded_by_me && <span className="small muted">Uploaded by you</span>}
        </div>
      </div>

      {book.free_now && book.free_until && (
        <div className="note warn">
          <b>Free for everyone for {daysLeft(book.free_until)} more day{daysLeft(book.free_until) === 1 ? '' : 's'}</b> (until {fmtDate(book.free_until)}). Chapters you finish stay yours.
        </div>
      )}

      {ownCopy ? (
        <section className="card col">
          <h2 style={{ fontSize: 17 }}>Learn from your own copy</h2>
          <p style={{ margin: 0 }}>This is a modern book, so SHRAVAN has no text of it. It never teaches a book from memory.</p>
          <Link href={`/add?for=${book.id}`} className="btn">
            Upload my copy (PDF or EPUB)
          </Link>
          <Link href={`/readalong/new?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author || '')}`} className="btn outline">
            I have the paper book: Read-along
          </Link>
          {book.buy_url && (
            <a href={book.buy_url} target="_blank" rel="noreferrer" className="small">
              Where to buy this book
            </a>
          )}
        </section>
      ) : (
        <section className="card col" aria-label="Source check">
          <div className="row between">
            <h2 style={{ fontSize: 17 }}>Book check</h2>
            {statusChip}
          </div>
          {book.status === 'ready' && (
            <div className="grid3">
              <div className="col" style={{ gap: 0, background: 'var(--bg)', borderRadius: 12, padding: 10 }}>
                <b style={{ fontSize: 20 }}>{source.textWords.toLocaleString('en-IN')}</b>
                <span className="tiny muted">words of text</span>
              </div>
              <div className="col" style={{ gap: 0, background: 'var(--bg)', borderRadius: 12, padding: 10 }}>
                <b style={{ fontSize: 20 }}>{pct}%</b>
                <span className="tiny muted">in the chapters taught</span>
              </div>
              <div className="col" style={{ gap: 0, background: 'var(--bg)', borderRadius: 12, padding: 10 }}>
                <b style={{ fontSize: 20 }}>
                  {chapters.filter((c) => c.completed).length}/{chapters.length}
                </b>
                <span className="tiny muted">chapters done</span>
              </div>
            </div>
          )}
          {book.status_note && <p className="small muted" style={{ margin: 0 }}>{book.status_note}</p>}
          {book.status === 'ready' && !d.fullAccess && (
            <p className="small" style={{ margin: 0 }}>
              Free part: chapter 1{source.freePartIsWholeChapter ? ` (fits within ${source.freePartPages} pages)` : `, first ${source.freePartPages} pages`}.
              {d.firstAccess === 'preview_needed' && ` Uses 1 of your ${d.previewsLeft} free previews.`}
            </p>
          )}
          <p className="tiny muted" style={{ margin: 0 }}>
            Examples are marked <b>From the book</b> or <b>Teacher&apos;s example</b>. Quotes are checked word for word.
          </p>
        </section>
      )}

      {chapters.length > 0 && !ownCopy && (
        <section className="card col" style={{ padding: '6px 14px', gap: 0 }} aria-label="Chapters">
          {chapters.map((c, i) => (
            <div key={c.id} className="row between" style={{ padding: '10px 0', borderBottom: i < chapters.length - 1 ? '1px solid var(--border)' : 'none' }}>
              {c.open ? (
                <Link href={`/learn/${c.id}`} style={{ color: 'var(--ink)', textDecoration: 'none', flex: 1 }}>
                  {c.idx} · {c.title}
                </Link>
              ) : (
                <span className="lock" style={{ flex: 1 }}>
                  {c.idx} · {c.title}
                </span>
              )}
              {editing ? (
                <span className="row" style={{ gap: 4 }}>
                  <button className="linkbtn" onClick={() => rename(c.idx, c.title)}>
                    Rename
                  </button>
                  {i < chapters.length - 1 && (
                    <button className="linkbtn" onClick={() => merge(c.idx)}>
                      Join next
                    </button>
                  )}
                </span>
              ) : c.completed ? (
                <span className="chip good">Done</span>
              ) : c.idx === 1 && !d.fullAccess ? (
                <span className="chip gold">FREE</span>
              ) : !c.open ? (
                <span className="muted" aria-label="Locked">
                  <Icon name="lock" />
                </span>
              ) : null}
            </div>
          ))}
        </section>
      )}
      {book.can_edit_chapters && chapters.length > 0 && (
        <button className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => setEditing(!editing)}>
          {editing ? 'Done fixing chapters' : 'Chapters look wrong? Fix them'}
        </button>
      )}

      {!ownCopy && book.status === 'ready' && next && (
        <div className="col">
          {d.firstAccess === 'locked' && !d.fullAccess && next.idx === 1 ? (
            <>
              <div className="note warn">You have used all 5 free previews.</div>
              <Link href="/subscribe" className="btn">
                See what a subscription opens
              </Link>
            </>
          ) : (
            <Link href={d.settings ? `/learn/${next.id}` : `/book/${id}/setup`} className="btn">
              {d.settings ? `Continue chapter ${next.idx}` : 'Start learning'}
            </Link>
          )}
          {d.settings && (
            <Link href={`/book/${id}/setup`} className="btn ghost">
              Change mode, level or language
            </Link>
          )}
          {allDone && (
            <Link href={`/book/${id}/plan`} className="btn accent">
              Your end-of-book action plan
            </Link>
          )}
        </div>
      )}
      {hasFile && (
        <button className="linkbtn small" onClick={() => downloadBookFile(id).catch((e) => setError((e as Error).message))}>
          Download the original file
        </button>
      )}
      {me?.isAdmin && book.is_library && (
        <Link href="/admin" className="small">
          Manage in Admin
        </Link>
      )}
      <BottomNav />
    </main>
  );
}
