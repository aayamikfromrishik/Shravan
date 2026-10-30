'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, daysLeft, fmtDate } from '@/lib/client';
import { useApp } from '@/components/AppProvider';
import { BottomNav, ErrorNote, Icon, Loading } from '@/components/ui';

interface Home {
  journey: { title: string; count: number; next: { id: string; title: string } | null } | null;
  continue: { bookId: string; title: string; author: string | null; kind: string; chapterIdx: number; chapterId: string | null; chapterTitle: string | null; chapters: number; step: string }[];
  freeNow: { id: string; title: string; free_until: string }[];
  subjects: { id: string; name: string; count: number }[];
  openActions: number;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function HomePage() {
  const { me, session } = useApp();
  const [data, setData] = useState<Home | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    api<Home>('/api/home').then(setData).catch((e) => setError(e.message));
  }, [session]);

  const cont = data?.continue[0];
  const contHref = cont ? (cont.kind === 'readalong' ? `/readalong/${cont.bookId}?chapter=${cont.chapterIdx}` : cont.chapterId ? `/learn/${cont.chapterId}` : `/book/${cont.bookId}`) : '#';

  return (
    <main className="page">
      <div className="row between">
        <div className="col" style={{ gap: 0 }}>
          <span className="row" style={{ gap: 6, alignItems: 'baseline' }}>
            <span className="wordmark">SHRAVAN</span>
            <span className="tiny muted">by AAYAMIK</span>
          </span>
          <h1 style={{ fontSize: 24 }}>{greeting()}</h1>
        </div>
        <div className="row">
          {me?.isAdmin && (
            <Link href="/admin" className="btn small ghost" style={{ minHeight: 40 }}>
              Admin
            </Link>
          )}
          <Link href="/search" className="iconbtn" aria-label="Search">
            <Icon name="search" />
          </Link>
        </div>
      </div>

      <ErrorNote error={error} />
      {!data && !error && <Loading />}

      {data?.freeNow.map((b) => (
        <Link key={b.id} href={`/book/${b.id}`} className="note warn row" style={{ textDecoration: 'none', gap: 12 }}>
          <span className="chip gold" style={{ fontWeight: 700 }}>
            FREE NOW
          </span>
          <span className="col grow" style={{ gap: 0 }}>
            <b style={{ fontSize: 15 }}>
              {b.title} is free for {daysLeft(b.free_until)} more day{daysLeft(b.free_until) === 1 ? '' : 's'}
            </b>
            <span className="tiny">Whole book open to everyone, until {fmtDate(b.free_until)}</span>
          </span>
        </Link>
      ))}

      {cont && (
        <div className="card hero col" style={{ gap: 10 }}>
          <span className="label" style={{ color: 'var(--accent)' }}>
            Continue
          </span>
          <div className="col" style={{ gap: 0 }}>
            <span style={{ fontFamily: 'var(--heading-font)', fontSize: 21, fontWeight: 600 }}>{cont.title}</span>
            <span className="small" style={{ color: 'var(--hero-muted)' }}>
              {cont.kind === 'readalong' ? 'Read-along · ' : ''}Chapter {cont.chapterIdx}
              {cont.chapters ? ` of ${cont.chapters}` : ''}
              {cont.chapterTitle && cont.kind !== 'readalong' ? ` · ${cont.chapterTitle}` : ''}
            </span>
          </div>
          {cont.chapters > 0 && (
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.18)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(((cont.chapterIdx - 1) / cont.chapters) * 100)}%`, height: 6, background: 'var(--accent)' }} />
            </div>
          )}
          <div className="row between">
            <span className="small" style={{ color: 'var(--hero-muted)' }}>
              {data?.openActions ? `${data.openActions} action${data.openActions > 1 ? 's' : ''} in progress` : ' '}
            </span>
            <Link href={contHref} className="btn accent small">
              <Icon name="play" size={16} /> Continue
            </Link>
          </div>
        </div>
      )}

      {data &&
        (data.journey ? (
          <Link href="/journey" className="card col" style={{ textDecoration: 'none', color: 'var(--ink)', gap: 4 }}>
            <span className="tiny" style={{ color: 'var(--label)', fontWeight: 700, letterSpacing: '0.08em' }}>
              YOUR JOURNEY · {data.journey.count} BOOKS
            </span>
            <b>{data.journey.title}</b>
            <span className="small muted">{data.journey.next ? `Next: ${data.journey.next.title}` : 'Journey complete. Plan the next one.'}</span>
          </Link>
        ) : (
          <Link href="/journey" className="card col" style={{ textDecoration: 'none', color: 'var(--ink)', gap: 4 }}>
            <b>Plan your learning journey</b>
            <span className="small muted">Choose the books you want to read, in your order, or tell SHRAVAN what you want to grow in and get a suggested path.</span>
          </Link>
        ))}

      <Link href="/add" className="btn ghost" style={{ borderStyle: 'dashed', borderColor: 'var(--link)' }}>
        <Icon name="plus" /> Add a book
      </Link>

      {data && (
        <section className="col">
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <h2 style={{ fontSize: 19 }}>Library</h2>
            {me && !me.isSubscriber && !me.isAdmin && (
              <span className="tiny muted">
                {me.previewsLeft} of 5 free previews left
              </span>
            )}
          </div>
          <div className="grid2">
            {data.subjects.map((s) => (
              <Link key={s.id} href={`/library/${s.id}`} className="card tile">
                <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>{s.name}</span>
                <span className="tiny muted">
                  {s.count} {s.id === 'spiritual' ? 'texts' : 'books'}
                  {s.id === 'business' ? ' · your own copy' : ''}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <BottomNav />
    </main>
  );
}
