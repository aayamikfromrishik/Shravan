'use client';
// My learning journey: the learner's own order of books. Build it by hand, or ask SHRAVAN to suggest one from a few words.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { BottomNav, ErrorNote, Loading, TopBar } from '@/components/ui';

interface Cand {
  id: string;
  title: string;
  author: string | null;
  section: string;
  ownCopy: boolean;
  mine: boolean;
}
interface Item extends Cand {
  why: string | null;
  progress: { total: number; done: number };
}
interface Resp {
  journey: { title: string | null; keywords: string | null; items: Item[] } | null;
  candidates: Cand[];
}
interface Suggestion {
  title: string;
  intro: string;
  items: (Cand & { why: string })[];
}

const IDEAS = ['Discipline & habits', 'A calm mind', 'Money & career', 'Speaking with confidence', 'Leadership', 'Spiritual growth', 'Indian wisdom', 'Big ideas & history', 'Running a design business'];

export default function JourneyPage() {
  const [d, setD] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'plan' | 'add'>('view');
  const [keywords, setKeywords] = useState('');
  const [length, setLength] = useState(5);
  const [busy, setBusy] = useState(false);
  const [sugg, setSugg] = useState<Suggestion | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    api<Resp>('/api/journey')
      .then((r) => {
        setD(r);
        if (!r.journey?.items.length) setMode('plan');
        setKeywords(r.journey?.keywords || '');
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const items = useMemo(() => d?.journey?.items || [], [d]);
  const save = async (next: { bookId: string; why?: string | null }[], title?: string, kw?: string) => {
    setError(null);
    try {
      await api('/api/journey', {
        method: 'PUT',
        body: { title: title ?? d?.journey?.title ?? 'My learning journey', keywords: kw ?? keywords, items: next.map((i) => ({ bookId: i.bookId, why: i.why || undefined })) },
      });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const asList = () => items.map((i) => ({ bookId: i.id, why: i.why }));
  const move = (i: number, dir: -1 | 1) => {
    const l = asList();
    const j = i + dir;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    save(l);
  };
  const removeAt = (i: number) => save(asList().filter((_, k) => k !== i));
  const add = (id: string) => {
    save([...asList(), { bookId: id }]);
    setMode('view');
  };

  const suggest = async () => {
    setBusy(true);
    setError(null);
    setSugg(null);
    try {
      setSugg(await api<Suggestion>('/api/journey/suggest', { body: { keywords, length } }));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  const useSuggestion = async () => {
    if (!sugg) return;
    await save(
      sugg.items.map((i) => ({ bookId: i.id, why: i.why })),
      sugg.title,
      keywords,
    );
    setSugg(null);
    setMode('view');
  };

  if (!d) return <main className="page">{error ? <ErrorNote error={error} /> : <Loading />}</main>;

  const nextIdx = items.findIndex((b) => !b.progress.total || b.progress.done < b.progress.total);
  const inJourney = new Set(items.map((i) => i.id));
  const pickable = d.candidates.filter((c) => !inJourney.has(c.id) && (c.title + ' ' + (c.author || '') + ' ' + c.section).toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <main className="page">
      <TopBar back="/" title="My learning journey" />
      <ErrorNote error={error} />

      {mode === 'plan' && (
        <section className="card col">
          <h2 style={{ margin: 0, fontSize: 20 }}>What do you want to grow in?</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Write a few words, for example “discipline, calm, money”. SHRAVAN suggests books from the library in a good order. You can change everything after.
          </p>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {IDEAS.map((k) => (
              <button key={k} className="btn small ghost" onClick={() => setKeywords((v) => (v ? `${v}, ${k.toLowerCase()}` : k.toLowerCase()))}>
                + {k}
              </button>
            ))}
          </div>
          <textarea rows={2} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. build better habits, stay calm under pressure, grow my business" />
          <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="small muted">How many books?</span>
            {[3, 5, 8].map((n) => (
              <button key={n} className={`btn small ${length === n ? '' : 'ghost'}`} onClick={() => setLength(n)}>
                {n}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={suggest} disabled={busy || keywords.trim().length < 3}>
              {busy ? 'Thinking…' : 'Suggest my journey'}
            </button>
            <button className="btn ghost" onClick={() => setMode('add')}>
              Choose books myself
            </button>
            {items.length > 0 && (
              <button className="linkbtn" onClick={() => { setMode('view'); setSugg(null); }}>
                Back to my journey
              </button>
            )}
          </div>

          {sugg && (
            <div className="col" style={{ gap: 8 }}>
              <h3 style={{ margin: '8px 0 0' }}>{sugg.title}</h3>
              <p className="small" style={{ margin: 0 }}>{sugg.intro}</p>
              {sugg.items.map((b, i) => (
                <div key={b.id} className="card col" style={{ gap: 2 }}>
                  <b>
                    {i + 1}. {b.title}
                  </b>
                  <span className="tiny muted">
                    {b.author ? `${b.author} · ` : ''}
                    {b.section}
                    {b.ownCopy ? ' · needs your own copy' : ''}
                  </span>
                  <span className="small">{b.why}</span>
                </div>
              ))}
              <div className="row" style={{ gap: 8 }}>
                <button className="btn accent" onClick={useSuggestion}>
                  Use this journey
                </button>
                <button className="btn ghost" onClick={suggest} disabled={busy}>
                  Try again
                </button>
              </div>
              {items.length > 0 && <span className="tiny muted">Using this replaces your current journey. Your progress in each book is kept.</span>}
            </div>
          )}
        </section>
      )}

      {mode === 'add' && (
        <section className="card col">
          <div className="row between">
            <h2 style={{ margin: 0, fontSize: 20 }}>Add a book</h2>
            <button className="linkbtn small" onClick={() => setMode(items.length ? 'view' : 'plan')}>
              Done
            </button>
          </div>
          <input placeholder="Search title, author or section" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="col" style={{ gap: 6, maxHeight: 460, overflow: 'auto' }}>
            {pickable.map((c) => (
              <button key={c.id} className="card row between" style={{ textAlign: 'left', gap: 8 }} onClick={() => add(c.id)}>
                <span className="col" style={{ gap: 0 }}>
                  <b className="small">{c.title}</b>
                  <span className="tiny muted">
                    {c.author ? `${c.author} · ` : ''}
                    {c.section}
                    {c.ownCopy ? ' · needs your own copy' : ''}
                  </span>
                </span>
                <span className="small">+ Add</span>
              </button>
            ))}
            {pickable.length === 0 && <span className="small muted">No more books match.</span>}
          </div>
        </section>
      )}

      {mode === 'view' && items.length > 0 && (
        <section className="col">
          <h2 style={{ margin: 0, fontSize: 21 }}>{d.journey?.title || 'My learning journey'}</h2>
          {d.journey?.keywords && <span className="tiny muted">Growing in: {d.journey.keywords}</span>}
          {items.map((b, i) => {
            const pct = b.progress.total ? Math.round((b.progress.done / b.progress.total) * 100) : 0;
            const finished = b.progress.total > 0 && b.progress.done >= b.progress.total;
            return (
              <div key={b.id} className="card col" style={{ gap: 6, borderColor: i === nextIdx ? 'var(--accent)' : undefined }}>
                <div className="row between" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <span className="col" style={{ gap: 2 }}>
                    <span className="tiny" style={{ color: 'var(--label)', fontWeight: 700 }}>
                      {finished ? '✓ DONE' : i === nextIdx ? 'UP NEXT' : `BOOK ${i + 1}`}
                    </span>
                    <b>{b.title}</b>
                    <span className="tiny muted">
                      {b.author ? `${b.author} · ` : ''}
                      {b.section}
                      {b.ownCopy ? ' · needs your own copy' : ''}
                    </span>
                  </span>
                  <span className="row" style={{ gap: 2 }}>
                    <button className="iconbtn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                      ↑
                    </button>
                    <button className="iconbtn" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">
                      ↓
                    </button>
                    <button className="iconbtn" onClick={() => removeAt(i)} aria-label="Remove from journey">
                      ✕
                    </button>
                  </span>
                </div>
                {b.why && <span className="small">{b.why}</span>}
                {b.progress.total > 0 && (
                  <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 3 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
                    </div>
                    <span className="tiny muted">
                      {b.progress.done}/{b.progress.total} chapters
                    </span>
                  </div>
                )}
                <Link href={`/book/${b.id}`} className={`btn small ${i === nextIdx ? '' : 'ghost'}`} style={{ alignSelf: 'flex-start' }}>
                  {finished ? 'Open' : b.progress.done ? 'Continue' : 'Start'}
                </Link>
              </div>
            );
          })}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn ghost" onClick={() => setMode('add')}>
              + Add a book
            </button>
            <button className="btn ghost" onClick={() => setMode('plan')}>
              Plan again with SHRAVAN
            </button>
          </div>
        </section>
      )}
      <BottomNav />
    </main>
  );
}
