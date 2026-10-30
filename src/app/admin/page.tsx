'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, daysLeft, downloadBookFile, fmtDate, uploadBook } from '@/lib/client';
import { SUBJECTS } from '@/lib/config';
import { useApp } from '@/components/AppProvider';
import { GOOD_FOR_LESSONS, VOICE_CATALOG } from '@/lib/voices-catalog';

const VOICE_SUGGESTIONS_COUNT = Object.values(VOICE_CATALOG).reduce((n, l) => n + l.voices.length, 0);
import { ErrorNote, Loading } from '@/components/ui';

interface AB {
  id: string;
  title: string;
  author: string | null;
  edition: string | null;
  subject: string | null;
  published: boolean;
  needs_own_copy: boolean;
  free_until: string | null;
  status: string;
  status_note: string | null;
  word_count: number | null;
  rights: string | null;
}
type Tab = 'library' | 'starter' | 'add' | 'bulk' | 'flags' | 'learners' | 'usage' | 'voice' | 'health';

export default function Admin() {
  const { me } = useApp();
  const [tab, setTab] = useState<Tab>('library');
  if (!me) return <main className="page wide"><Loading /></main>;
  if (!me.isAdmin)
    return (
      <main className="page">
        <p>Admin only.</p>
        <Link href="/">Home</Link>
      </main>
    );
  const tabs: [Tab, string][] = [
    ['library', 'Library'],
    ['starter', 'Starter library'],
    ['add', 'Add a book'],
    ['bulk', 'Create in bulk'],
    ['flags', 'Flagged lessons'],
    ['learners', 'Learners'],
    ['usage', 'Usage & costs'],
    ['voice', 'Narrator voice'],
    ['health', 'System check'],
  ];
  return (
    <main className="page wide nonav">
      <div className="row between">
        <div className="col" style={{ gap: 0 }}>
          <span className="wordmark">SHRAVAN</span>
          <span className="tiny muted">by AAYAMIK · Admin</span>
        </div>
        <Link href="/" className="btn small ghost">
          Back to the app
        </Link>
      </div>
      <nav className="row" style={{ flexWrap: 'wrap', gap: 6 }} aria-label="Admin sections">
        {tabs.map(([t, label]) => (
          <button key={t} className={`btn small ${tab === t ? '' : 'ghost'}`} onClick={() => setTab(t)} aria-pressed={tab === t}>
            {label}
          </button>
        ))}
      </nav>
      {tab === 'library' && <LibraryTab />}
      {tab === 'starter' && <StarterTab />}
      {tab === 'add' && <AddTab onDone={() => setTab('library')} />}
      {tab === 'flags' && <FlagsTab />}
      {tab === 'learners' && <LearnersTab />}
      {tab === 'usage' && <UsageTab />}
      {tab === 'bulk' && <BulkTab />}
      {tab === 'voice' && <VoiceTab />}
      {tab === 'health' && <HealthTab />}
    </main>
  );
}

function LibraryTab() {
  const [books, setBooks] = useState<AB[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freeFor, setFreeFor] = useState<AB | null>(null);
  const load = useCallback(() => {
    api<{ books: AB[] }>('/api/admin/books')
      .then((r) => setBooks(r.books))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const publish = async (b: AB, v: boolean) => {
    try {
      await api(`/api/admin/books/${b.id}`, { method: 'PATCH', body: { published: v } });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
      <section className="col" style={{ flex: '999 1 560px', minWidth: 0 }}>
        <ErrorNote error={error} />
        {!books && <Loading />}
        <div className="tablewrap card" style={{ padding: 0 }}>
          <table className="admin">
            <thead>
              <tr>
                <th>Book</th>
                <th>Subject</th>
                <th>Access</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {books?.map((b) => {
                const free = b.free_until && new Date(b.free_until) > new Date();
                return (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/book/${b.id}`} style={{ color: 'var(--ink)', fontWeight: 600 }}>
                        {b.title}
                      </Link>
                      <div className="tiny muted">
                        {b.author}
                        {b.edition ? ` · ${b.edition}` : ''}
                        {b.needs_own_copy ? ' · learner brings own copy' : b.word_count ? ` · ${b.word_count.toLocaleString('en-IN')} words` : ''}
                      </div>
                    </td>
                    <td className="small">{SUBJECTS.find((s) => s.id === b.subject)?.name}</td>
                    <td className="small">
                      {!b.published ? <span className="chip warn">Not published</span> : free ? <span className="chip good">Free until {fmtDate(b.free_until!)}</span> : <span className="muted">Paid · free part</span>}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button className="linkbtn" onClick={() => publish(b, !b.published)}>
                          {b.published ? 'Unpublish' : 'Publish'}
                        </button>
                        {!b.needs_own_copy && (
                          <button className="linkbtn" onClick={() => downloadBookFile(b.id).catch((e) => setError((e as Error).message))}>
                            Download
                          </button>
                        )}
                        {!b.needs_own_copy && b.status === 'ready' && (
                          <button className="linkbtn" onClick={() => setFreeFor(b)}>
                            {free ? 'Free settings' : 'Make free'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {freeFor && <FreePanel book={freeFor} onClose={() => { setFreeFor(null); load(); }} />}
    </div>
  );
}

function FreePanel({ book, onClose }: { book: AB; onClose: () => void }) {
  const [days, setDays] = useState(3);
  const [custom, setCustom] = useState('');
  const [reminder, setReminder] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = custom ? Number(custom) : days;
  // eslint-disable-next-line react-hooks/purity -- shows the end date for the chosen number of days
  const until = new Date(Date.now() + n * 86400000);
  const active = book.free_until && new Date(book.free_until) > new Date();

  const go = async (d: number) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/books/${book.id}/free`, { body: { days: d, reminder } });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <section className="card col" style={{ flex: '1 1 300px', maxWidth: 360, borderWidth: 2, borderColor: 'var(--accent)' }} aria-label="Make a book free">
      <span className="label">Make free for everyone</span>
      <h2 style={{ fontSize: 20 }}>{book.title}</h2>
      {active && (
        <div className="note good">
          Free now, {daysLeft(book.free_until!)} day(s) left (until {fmtDate(book.free_until!)}).
        </div>
      )}
      <span style={{ fontWeight: 600 }}>{active ? 'Extend or restart for' : 'For how long?'}</span>
      <div className="grid3">
        {[3, 5, 7].map((d) => (
          <button key={d} className={`btn small ${!custom && days === d ? '' : 'ghost'}`} onClick={() => { setDays(d); setCustom(''); }} aria-pressed={!custom && days === d}>
            {d} days
          </button>
        ))}
      </div>
      <label className="row small" style={{ gap: 8 }}>
        Or
        <input type="number" min={1} max={365} value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} placeholder="10" style={{ width: 80 }} />
        days
      </label>
      <div className="note good" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
        <div className="tiny muted">Notice to all learners (in-app + phone)</div>
        {book.title} is free for {n} day{n === 1 ? '' : 's'}, until {fmtDate(until.toISOString())}. Start any time.
      </div>
      <label className="row small" style={{ gap: 8 }}>
        <input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} /> Remind learners 1 day before it ends
      </label>
      <span className="tiny muted">When the time is up the book goes back to paid automatically. Learners keep the chapters they completed.</span>
      <ErrorNote error={error} />
      <button className="btn accent" disabled={busy || !n || n < 1} onClick={() => go(n)}>
        {busy ? 'Saving…' : 'Make free and notify'}
      </button>
      {active && (
        <button className="btn danger small" disabled={busy} onClick={() => go(0)}>
          End the free period now
        </button>
      )}
      <button className="linkbtn" onClick={onClose}>
        Close
      </button>
    </section>
  );
}

function AddTab({ onDone }: { onDone: () => void }) {
  const [source, setSource] = useState<'upload' | 'link' | 'placeholder'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [edition, setEdition] = useState('');
  const [subject, setSubject] = useState('habits');
  const [rights, setRights] = useState<'' | 'public_domain' | 'own_work' | 'permission'>('');
  const [buyUrl, setBuyUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ chapters?: { idx: number; title: string; words: number }[]; leftOut?: { title: string; words: number }[]; status?: string; note?: string; bookId?: string; words?: number; pageCount?: number } | null>(null);

  const submit = async () => {
    setError(null);
    setResult(null);
    try {
      let path: string | undefined;
      if (source === 'upload') {
        if (!file) throw new Error('Choose a file first.');
        setBusy('Uploading…');
        path = (await uploadBook(file)).path;
      }
      setBusy('Reading the book and finding chapters…');
      const r = await api<typeof result & { ok: boolean }>('/api/admin/books', {
        body: { source, path, fileName: file?.name, url, title, author, edition, subject, rights: rights || undefined, buyUrl },
      });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
      <section className="card col" style={{ flex: '1 1 340px' }}>
        <span className="label">1 · Source</span>
        <div className="seg" role="group" aria-label="Source">
          {(
            [
              ['upload', 'Upload'],
              ['link', 'Link'],
              ['placeholder', 'Own-copy title'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={source === v} onClick={() => setSource(v)}>
              {l}
            </button>
          ))}
        </div>
        {source === 'upload' && <input type="file" accept=".pdf,.epub,.txt" onChange={(e) => setFile(e.target.files?.[0] || null)} />}
        {source === 'link' && <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.gutenberg.org/cache/epub/…/pg….txt" />}
        {source === 'placeholder' && <p className="small muted" style={{ margin: 0 }}>A modern book shown in the library; learners upload their own copy or use Read-along.</p>}

        <span className="label" style={{ marginTop: 8 }}>
          2 · Details
        </span>
        <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input type="text" placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
        {source !== 'placeholder' && <input type="text" placeholder="Translation / edition (e.g. George Long, 1862)" value={edition} onChange={(e) => setEdition(e.target.value)} />}
        <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
          {SUBJECTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {source === 'placeholder' && <input type="url" placeholder="Where to buy (optional link)" value={buyUrl} onChange={(e) => setBuyUrl(e.target.value)} />}

        {source !== 'placeholder' && (
          <>
            <span className="label" style={{ marginTop: 8 }}>
              3 · Copyright status (required)
            </span>
            {(
              [
                ['public_domain', 'Public domain in India and the US'],
                ['own_work', 'My own work'],
                ['permission', 'Permission from the rights holder'],
              ] as const
            ).map(([v, l]) => (
              <label key={v} className={`option ${rights === v ? 'on' : ''}`}>
                <input type="radio" name="rights" checked={rights === v} onChange={() => setRights(v)} />
                <span>{l}</span>
              </label>
            ))}
          </>
        )}
        <ErrorNote error={error} />
        {busy ? (
          <Loading text={busy} />
        ) : (
          <button className="btn" onClick={submit} disabled={!title.trim() || (source !== 'placeholder' && !rights)}>
            Add (as unpublished)
          </button>
        )}
      </section>

      {result && (
        <section className="card col" style={{ flex: '1 1 340px' }}>
          <span className="label">Source check</span>
          {result.status && result.status !== 'ready' ? (
            <div className="note bad">{result.note}</div>
          ) : (
            <>
              <div className="note good">
                Added. {result.chapters ? `${result.chapters.length} chapters found` : ''}
                {result.pageCount ? ` · ${result.pageCount} pages` : ''}
                {result.words ? ` · ${result.words.toLocaleString('en-IN')} words` : ''}.
              </div>
              {!!result.leftOut?.length && (
                <p className="small muted" style={{ margin: 0 }}>
                  Not taught by default: {result.leftOut.map((l) => `${l.title} (${l.words} words)`).join(', ')}.
                </p>
              )}
              {result.chapters && (
                <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
                  {result.chapters.map((c) => (
                    <li key={c.idx}>
                      {c.title} <span className="muted">· {c.words} words</span>
                    </li>
                  ))}
                </ol>
              )}
              {result.bookId && (
                <Link href={`/book/${result.bookId}`} className="btn ghost small">
                  Open the book (fix chapters there)
                </Link>
              )}
              <button className="btn small" onClick={onDone}>
                Go to Library to publish
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function FlagsTab() {
  const [flags, setFlags] = useState<{ id: string; mode: string; level: string; lang: string; flag_note: string | null; chapters: { title: string; idx: number; books: { title: string } } }[] | null>(null);
  const load = useCallback(() => {
    api<{ flags: typeof flags }>('/api/admin/flags').then((r) => setFlags(r.flags));
  }, []);
  useEffect(load, [load]);
  const act = async (id: string, action: 'clear' | 'regenerate') => {
    await api(`/api/admin/versions/${id}`, { body: { action } });
    load();
  };
  if (!flags) return <Loading />;
  if (!flags.length) return <p className="muted">No lessons reported.</p>;
  return (
    <div className="col">
      {flags.map((f) => (
        <div key={f.id} className="card col">
          <b>
            {f.chapters?.books?.title} · chapter {f.chapters?.idx}: {f.chapters?.title}
          </b>
          <span className="small muted">
            {f.mode} · {f.level} · {f.lang}
          </span>
          {f.flag_note && <span>“{f.flag_note}”</span>}
          <div className="row">
            <button className="btn small" onClick={() => act(f.id, 'regenerate')}>
              Rewrite this lesson
            </button>
            <button className="btn small ghost" onClick={() => act(f.id, 'clear')}>
              It&apos;s fine
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function LearnersTab() {
  const [list, setList] = useState<{ email: string | null; name: string | null; plan: string; subscribed_until: string | null; created_at: string }[] | null>(null);
  const [email, setEmail] = useState('');
  const [days, setDays] = useState('30');
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => {
    api<{ learners: typeof list }>('/api/admin/learners').then((r) => setList(r.learners));
  }, []);
  useEffect(load, [load]);
  const set = async (plan: 'free' | 'subscriber') => {
    try {
      await api('/api/admin/learners', { body: { email, plan, days: Number(days) || undefined } });
      setMsg(plan === 'subscriber' ? 'Subscriber access given.' : 'Back to the free plan.');
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <div className="col">
      <section className="card col" style={{ maxWidth: 520 }}>
        <b>Give subscriber access (trial, before payments are on)</b>
        <input type="email" placeholder="Learner's email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="row small" style={{ gap: 8 }}>
          For
          <input type="number" value={days} onChange={(e) => setDays(e.target.value)} style={{ width: 80 }} />
          days (empty = no end date)
        </label>
        <div className="row">
          <button className="btn small" onClick={() => set('subscriber')} disabled={!email.includes('@')}>
            Make subscriber
          </button>
          <button className="btn small ghost" onClick={() => set('free')} disabled={!email.includes('@')}>
            Back to free
          </button>
        </div>
        {msg && <span className="small">{msg}</span>}
      </section>
      {!list ? (
        <Loading />
      ) : (
        <div className="tablewrap card" style={{ padding: 0 }}>
          <table className="admin">
            <thead>
              <tr>
                <th>Learner</th>
                <th>Plan</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {list.map((l, i) => (
                <tr key={i}>
                  <td>
                    {l.name || '—'}
                    <div className="tiny muted">{l.email}</div>
                  </td>
                  <td className="small">
                    {l.plan}
                    {l.subscribed_until ? ` until ${fmtDate(l.subscribed_until)}` : ''}
                  </td>
                  <td className="small">{fmtDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UsageTab() {
  const [u, setU] = useState<{ learners: number; subscribers: number; lessons: number; books: number; last30Days: { totalInr: number; byKind: Record<string, { calls: number; inr: number }> } } | null>(null);
  useEffect(() => {
    api<typeof u>('/api/admin/usage').then(setU);
  }, []);
  if (!u) return <Loading />;
  return (
    <div className="col" style={{ maxWidth: 640 }}>
      <div className="grid2">
        {(
          [
            ['Learners', u.learners],
            ['Subscribers', u.subscribers],
            ['Books with text', u.books],
            ['Saved lessons', u.lessons],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="card col" style={{ gap: 0 }}>
            <b style={{ fontSize: 24 }}>{v ?? 0}</b>
            <span className="small muted">{l}</span>
          </div>
        ))}
      </div>
      <section className="card col">
        <b>AI cost, last 30 days: about ₹{u.last30Days.totalInr.toLocaleString('en-IN')}</b>
        {Object.entries(u.last30Days.byKind).map(([k, v]) => (
          <span key={k} className="small">
            {k}: {v.calls} calls · ₹{Math.round(v.inr).toLocaleString('en-IN')}
          </span>
        ))}
        <span className="tiny muted">Estimated from Claude Sonnet 5.5 list prices. The phone&apos;s voice is free. Journals and actions are never shown here.</span>
      </section>
    </div>
  );
}

interface CatBook {
  slug: string;
  title: string;
  author?: string;
  subject: string;
  url?: string;
  verified?: boolean;
  sample?: boolean;
  needsOwnCopy?: boolean;
  note?: string;
  imported: boolean;
}

function StarterTab() {
  const [books, setBooks] = useState<CatBook[] | null>(null);
  const [own, setOwn] = useState<{ title: string; note: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const load = useCallback(() => {
    api<{ books: CatBook[]; ownBooks: { title: string; note: string }[] }>('/api/admin/library')
      .then((r) => {
        setBooks(r.books);
        setOwn(r.ownBooks);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const add = (line: string) => setLog((l) => [...l, line]);
  const importList = async (list: CatBook[]) => {
    setBusy(true);
    setLog([]);
    for (const b of list) {
      add(`${b.title}: importing…`);
      try {
        const r = await api<{ ok: boolean; note: string }>('/api/admin/library', { method: 'POST', body: { slug: b.slug } });
        add(`${b.title}: ${r.ok ? '✓' : '✗'} ${r.note}`);
      } catch (e) {
        add(`${b.title}: ✗ ${(e as Error).message}`);
      }
    }
    setBusy(false);
    load();
  };
  const samples = async () => {
    setBusy(true);
    try {
      const r = await api<{ results: { slug: string; ok: boolean; note: string }[] }>('/api/admin/library', { method: 'POST', body: { samples: true } });
      setLog(r.results.map((x) => `${x.slug}: ${x.ok ? '✓' : '✗'} ${x.note}`));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  if (!books) return error ? <ErrorNote error={error} /> : <Loading />;
  const ready = books.filter((b) => !b.imported && (b.url || b.needsOwnCopy));
  const sampleBooks = books.filter((b) => b.sample && !b.imported);
  return (
    <section className="col">
      <ErrorNote error={error} />
      <div className="card col">
        <p className="small" style={{ margin: 0 }}>
          The catalogue agreed in the spec. Importing downloads each public-domain text, splits it into chapters and publishes it. Business titles are added as
          &quot;bring your own copy&quot;.
        </p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn small" disabled={busy || !sampleBooks.length} onClick={() => importList(sampleBooks)}>
            1 · Import the 5 sample books
          </button>
          <button className="btn small" disabled={busy} onClick={samples}>
            2 · Attach sample lessons
          </button>
          <button className="btn small ghost" disabled={busy || !ready.length} onClick={() => importList(ready)}>
            Import everything else ({ready.length})
          </button>
          <button className="btn small ghost" disabled={busy} onClick={() => importList(books.filter((b) => b.imported && b.url))}>
            Update imported books (keep files, sections)
          </button>
        </div>
        {own.map((o) => (
          <p key={o.title} className="tiny muted" style={{ margin: 0 }}>
            <b>{o.title}:</b> {o.note}
          </p>
        ))}
        {log.length > 0 && (
          <pre className="tiny" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {log.join('\n')}
          </pre>
        )}
      </div>
      <div className="tablewrap card" style={{ padding: 0 }}>
        <table className="admin">
          <thead>
            <tr>
              <th>Book</th>
              <th>Subject</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {books.map((b) => (
              <tr key={b.slug}>
                <td>
                  <span style={{ fontWeight: 600 }}>{b.title}</span>
                  {b.sample && <span className="chip good" style={{ marginLeft: 6 }}>Sample</span>}
                  <div className="tiny muted">{b.author}</div>
                </td>
                <td className="small">{SUBJECTS.find((s) => s.id === b.subject)?.name}</td>
                <td className="small">
                  {b.imported ? (
                    <span className="chip good">In the library</span>
                  ) : b.needsOwnCopy ? (
                    <span className="muted">Bring your own copy</span>
                  ) : b.url ? (
                    <span className="muted">{b.verified ? 'Link tested' : 'Link to check'}</span>
                  ) : (
                    <span className="chip warn">{b.note || 'Needs a link'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HealthTab() {
  const [checks, setChecks] = useState<{ name: string; ok: boolean | null; note: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(() => {
    setChecks(null);
    setError(null);
    api<{ checks: { name: string; ok: boolean | null; note: string }[] }>('/api/admin/health')
      .then((r) => setChecks(r.checks))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(run, [run]);
  return (
    <section className="col">
      <ErrorNote error={error} />
      {!checks && !error && <Loading />}
      {checks && (
        <div className="tablewrap card" style={{ padding: 0 }}>
          <table className="admin">
            <tbody>
              {checks.map((c) => (
                <tr key={c.name}>
                  <td style={{ width: 28, fontSize: 18 }}>{c.ok === true ? '✓' : c.ok === false ? '✗' : '•'}</td>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td className="small">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button className="btn small ghost" onClick={run} style={{ alignSelf: 'flex-start' }}>
        Check again
      </button>
    </section>
  );
}

type VoiceKey = 'english' | 'hindi' | 'mix' | 'spiritual_english' | 'spiritual_hindi';
interface VoiceSettingsUI {
  enabled: boolean;
  budgetInr: number;
  pace: number;
  voices: Record<VoiceKey, string>;
}
const VOICE_LABELS: [VoiceKey, string, string][] = [
  ['english', 'English lessons', 'en-IN'],
  ['hindi', 'Hindi lessons', 'hi-IN'],
  ['mix', 'Mix (Hinglish) lessons', 'hi-IN'],
  ['spiritual_english', 'Spiritual books, English', 'en-IN'],
  ['spiritual_hindi', 'Spiritual books, Hindi', 'hi-IN'],
];

function VoiceTab() {
  const [d, setD] = useState<{ settings: VoiceSettingsUI; suggestions: string[]; keySet: boolean; spentThisMonthInr: number; inrPer10kChars: number } | null>(null);
  const [form, setForm] = useState<VoiceSettingsUI | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [cat, setCat] = useState('en');
  const [line, setLine] = useState(VOICE_CATALOG.en.sample);
  const [lessonsOnly, setLessonsOnly] = useState(true);
  const [search, setSearch] = useState('');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [classicLang, setClassicLang] = useState('en-IN');
  const load = useCallback(() => {
    api<{ settings: VoiceSettingsUI; suggestions: string[]; keySet: boolean; spentThisMonthInr: number; inrPer10kChars: number }>('/api/admin/voice')
      .then((r) => {
        setD(r);
        setForm(r.settings);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    if (!form) return;
    setError(null);
    setSaved(false);
    try {
      await api('/api/admin/voice', { method: 'PUT', body: form });
      setSaved(true);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const listen = async (speaker: string) => {
    setPlayingVoice(speaker);
    setError(null);
    try {
      const r = await api<{ audio: string }>('/api/admin/voice/test', { body: { text: line, speaker, lang: cat === 'classic' ? classicLang : VOICE_CATALOG[cat].code, pace: form?.pace } });
      const a = new Audio('data:audio/mpeg;base64,' + r.audio);
      a.onended = () => setPlayingVoice(null);
      await a.play();
    } catch (e) {
      setError((e as Error).message);
      setPlayingVoice(null);
    }
  };

  if (!d || !form) return error ? <ErrorNote error={error} /> : <Loading />;
  return (
    <section className="col">
      <ErrorNote error={error} />
      {!d.keySet && <div className="note warn">Add SARVAM_API_KEY in Vercel (Settings → Environments → Production) and redeploy. Until then lessons use the phone voice.</div>}
      <datalist id="voice-names">
        {d.suggestions.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      <div className="card col">
        <h3 style={{ margin: 0 }}>Settings</h3>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          <span>Use the narrator voice in lessons (otherwise the phone voice)</span>
        </label>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <label className="col" style={{ gap: 4 }}>
            <span className="small muted">Monthly budget (₹, 0 = no limit)</span>
            <input type="number" min={0} step={50} value={form.budgetInr} onChange={(e) => setForm({ ...form, budgetInr: Number(e.target.value) })} style={{ width: 140 }} />
          </label>
          <label className="col" style={{ gap: 4 }}>
            <span className="small muted">Speaking speed (1 = normal)</span>
            <input type="number" min={0.5} max={2} step={0.05} value={form.pace} onChange={(e) => setForm({ ...form, pace: Number(e.target.value) })} style={{ width: 120 }} />
          </label>
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>
          Spent this month: ₹{d.spentThisMonthInr}
          {form.budgetInr ? ` of ₹${form.budgetInr}` : ''} · about ₹{d.inrPer10kChars} per 10,000 characters. When the budget is used up, lessons use the phone voice until next month.
        </p>
        {VOICE_LABELS.map(([k, label]) => (
          <label key={k} className="col" style={{ gap: 4 }}>
            <span className="small muted">{label}</span>
            <input list="voice-names" value={form.voices[k]} onChange={(e) => setForm({ ...form, voices: { ...form.voices, [k]: e.target.value.trim() } })} />
          </label>
        ))}
        <p className="tiny muted" style={{ margin: 0 }}>Changing a voice makes new narration the next time each lesson is played; audio already made with the old voice stays saved.</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn small" onClick={save}>
            Save
          </button>
          {saved && <span className="small">Saved ✓</span>}
        </div>
      </div>

      <div className="card col">
        <h3 style={{ margin: 0 }}>All voices ({VOICE_SUGGESTIONS_COUNT})</h3>
        <p className="tiny muted" style={{ margin: 0 }}>
          Pick a language, tap ▶ to hear a voice read the line below, then choose where to use it. Each try costs a fraction of a rupee. Remember to Save above.
        </p>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(VOICE_CATALOG).map(([k, l]) => (
            <button key={k} className={`btn small ${cat === k ? '' : 'ghost'}`} onClick={() => { setCat(k); setLine(l.sample); }}>
              {l.label} ({l.voices.length})
            </button>
          ))}
        </div>
        {VOICE_CATALOG[cat].note && <p className="tiny muted" style={{ margin: 0 }}>{VOICE_CATALOG[cat].note}</p>}
        {cat === 'classic' && (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {[
              ['en-IN', 'Read in English', VOICE_CATALOG.en.sample],
              ['hi-IN', 'Read in Hindi', VOICE_CATALOG.hi.sample],
              ['hi-IN', 'Read Mix', VOICE_CATALOG.enhi.sample],
              ['bn-IN', 'Read in Bengali', VOICE_CATALOG.bn.sample],
            ].map(([code, label, sample]) => (
              <button key={label} className={`btn small ${classicLang === code && line === sample ? '' : 'ghost'}`} onClick={() => { setClassicLang(code); setLine(sample); }}>
                {label}
              </button>
            ))}
          </div>
        )}
        <textarea rows={2} value={line} onChange={(e) => setLine(e.target.value)} aria-label="Line to read" />
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={lessonsOnly} onChange={(e) => setLessonsOnly(e.target.checked)} />
            <span className="small">Only styles suited to lessons (narration, stories, teacher, documentary, devotional, companion)</span>
          </label>
          <input placeholder="Search a name or style" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 220 }} />
        </div>
        <div className="tablewrap" style={{ padding: 0 }}>
          <table className="admin">
            <tbody>
              {VOICE_CATALOG[cat].voices
                .filter((v) => (!lessonsOnly || GOOD_FOR_LESSONS.test(v)) && v.includes(search.trim().toLowerCase()))
                .map((v) => {
                  const [person, , ...style] = v.split('_');
                  if (!v.includes('_')) style.push('classic · any language');
                  return (
                    <tr key={v}>
                      <td style={{ width: 44 }}>
                        <button className="btn small ghost" onClick={() => listen(v)} disabled={!!playingVoice || !d.keySet} aria-label={`Listen to ${v}`}>
                          {playingVoice === v ? '…' : '▶'}
                        </button>
                      </td>
                      <td>
                        <b style={{ textTransform: 'capitalize' }}>{person}</b> <span className="small muted">{style.join(' ')}</span>
                        <div className="tiny muted">{v}</div>
                      </td>
                      <td>
                        <select
                          value=""
                          onChange={(e) => {
                            const k = e.target.value as VoiceKey;
                            if (k) setForm({ ...form, voices: { ...form.voices, [k]: v } });
                          }}
                          aria-label={`Use ${v} for`}
                        >
                          <option value="">Use for…</option>
                          {VOICE_LABELS.map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                              {form.voices[k] === v ? ' ✓' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

type BMode = 'key' | 'examples' | 'complete';
type BLevel = 'basic' | 'normal' | 'advanced';
type BLang = 'english' | 'hindi' | 'mix';
interface BulkItemUI {
  book?: string;
  chapterId: string;
  idx: number;
  part: 'free' | 'full';
  mode: BMode;
  level: BLevel;
  lang: BLang;
}
const MODE_NAMES: Record<BMode, string> = { key: 'Key Ideas Only', examples: 'Key Ideas + Examples', complete: 'Complete Learning' };
const LEVEL_NAMES: Record<BLevel, string> = { basic: 'Simple English', normal: 'Normal', advanced: 'Advanced' };
const LANG_NAMES: Record<BLang, string> = { english: 'English', hindi: 'Hindi', mix: 'Mix' };

function Checks<T extends string>({ names, value, onChange }: { names: Record<T, string>; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      {(Object.keys(names) as T[]).map((k) => (
        <button key={k} className={`btn small ${value.includes(k) ? '' : 'ghost'}`} aria-pressed={value.includes(k)} onClick={() => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k])}>
          {names[k]}
        </button>
      ))}
    </div>
  );
}

interface PickSection {
  id: string;
  name: string;
  books: { id: string; title: string; sample: boolean; picked: boolean }[];
}

function BulkTab() {
  const [many, setMany] = useState(false);
  const [sections, setSections] = useState<PickSection[] | null>(null);
  const [freePart, setFreePart] = useState(true);
  const [upTo, setUpTo] = useState(1); // several books: chapters 1..upTo (100000 = whole book)
  const [books, setBooks] = useState<AB[] | null>(null);
  const [bookId, setBookId] = useState('');
  const [chapters, setChapters] = useState<{ idx: number; title: string }[]>([]);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [modes, setModes] = useState<BMode[]>(['examples']);
  const [levels, setLevels] = useState<BLevel[]>(['normal']);
  const [langs, setLangs] = useState<BLang[]>(['english']);
  const [audio, setAudio] = useState(true);
  const [plan, setPlan] = useState<{ items: BulkItemUI[]; total: number; lessonsToMake: number; audioToMake: number; estimateInr: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const stop = useRef(false);

  useEffect(() => {
    api<{ books: AB[] }>('/api/admin/books')
      .then((r) => setBooks(r.books.filter((b) => !b.needs_own_copy && b.status === 'ready')))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!many || sections) return;
    api<{ sections: PickSection[] }>('/api/admin/generate/picks?per=3')
      .then((r) => setSections(r.sections))
      .catch((e) => setError(e.message));
  }, [many, sections]);
  const pickedIds = (sections || []).flatMap((s) => s.books.filter((b) => b.picked).map((b) => b.id));
  const togglePick = (sid: string, bid: string) => {
    setPlan(null);
    setSections((ss) => (ss || []).map((s) => (s.id !== sid ? s : { ...s, books: s.books.map((b) => (b.id === bid ? { ...b, picked: !b.picked } : b)) })));
  };

  useEffect(() => {
    setPlan(null);
    if (!bookId) return setChapters([]);
    api<{ chapters: { idx: number; title: string }[] }>(`/api/books/${bookId}`)
      .then((r) => {
        setChapters(r.chapters);
        setFrom(1);
        setTo(r.chapters.length);
      })
      .catch((e) => setError(e.message));
  }, [bookId]);

  const makePlan = async () => {
    setError(null);
    setPlan(null);
    try {
      setPlan(
        await api('/api/admin/generate/plan', {
          body: many ? { bookIds: pickedIds, from: 1, to: upTo, modes, levels, langs, audio, freePart } : { bookId, from, to, modes, levels, langs, audio, freePart },
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const run = async () => {
    if (!plan) return;
    stop.current = false;
    setRunning(true);
    setDone(0);
    setLog([]);
    let i = 0;
    const next = async (): Promise<void> => {
      while (!stop.current && i < plan.items.length) {
        const it = plan.items[i++];
        const label = `${many && it.book ? `${it.book} · ` : ''}Ch ${it.idx}${it.part === 'free' ? ' (free part)' : ''} · ${MODE_NAMES[it.mode]} · ${LEVEL_NAMES[it.level]} · ${LANG_NAMES[it.lang]}`;
        try {
          const r = await api<{ lesson: string; audio: string }>('/api/admin/generate', { body: { item: it, audio } });
          setLog((l) => [`${r.lesson === 'failed' ? '✗' : '✓'} ${label}: lesson ${r.lesson}${audio ? `, narration ${r.audio}` : ''}`, ...l]);
        } catch (e) {
          setLog((l) => [`✗ ${label}: ${(e as Error).message}`, ...l]);
        }
        setDone((d) => d + 1);
      }
    };
    await Promise.all([next(), next()]); // two at a time
    setRunning(false);
  };

  if (!books) return error ? <ErrorNote error={error} /> : <Loading />;
  return (
    <section className="col">
      <ErrorNote error={error} />
      <div className="card col">
        <p className="small" style={{ margin: 0 }}>
          Create lessons (and their narration) ahead of time, so learners never wait. Anything already made is skipped and costs nothing. Keep this page open while it runs.
        </p>
        <div className="row" style={{ gap: 6 }}>
          <button className={`btn small ${!many ? '' : 'ghost'}`} onClick={() => { setMany(false); setPlan(null); }}>
            One book
          </button>
          <button
            className={`btn small ${many ? '' : 'ghost'}`}
            onClick={() => {
              setMany(true);
              setPlan(null);
              setLangs(['english', 'hindi']);
            }}
          >
            Several books
          </button>
        </div>
        {many && !sections && <Loading />}
        {many && sections && (
          <div className="col" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {[
                [1, 'Chapter 1 only'],
                [3, 'First 3 chapters'],
                [100000, 'Whole books'],
              ].map(([n, label]) => (
                <button key={n} className={`btn small ${upTo === n ? '' : 'ghost'}`} onClick={() => { setUpTo(n as number); setPlan(null); }}>
                  {label}
                </button>
              ))}
            </div>
            <span className="small muted">
              {upTo === 1 ? 'Chapter 1' : upTo === 100000 ? 'Every chapter' : `Chapters 1 to ${upTo}`} of the ticked books ({pickedIds.length}). Three per section are ticked to start; books with ready-made samples come first. Business has only the books that have text (yours).
            </span>
            {sections.map((s) => (
              <div key={s.id} className="col" style={{ gap: 4 }}>
                <b className="small">{s.name}</b>
                {s.books.length === 0 && <span className="tiny muted">No books with text yet.</span>}
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {s.books.map((b) => (
                    <button key={b.id} className={`btn small ${b.picked ? '' : 'ghost'}`} aria-pressed={b.picked} onClick={() => togglePick(s.id, b.id)}>
                      {b.title.length > 34 ? b.title.slice(0, 33) + '…' : b.title}
                      {b.sample ? ' ★' : ''}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {!many && (
        <label className="col" style={{ gap: 4 }}>
          <span className="small muted">Book</span>
          <select value={bookId} onChange={(e) => setBookId(e.target.value)}>
            <option value="">Choose a book…</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </label>
        )}
        {!many && chapters.length > 0 && (
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <label className="col" style={{ gap: 4 }}>
              <span className="small muted">From chapter</span>
              <select value={from} onChange={(e) => { setFrom(Number(e.target.value)); setPlan(null); }}>
                {chapters.map((c) => (
                  <option key={c.idx} value={c.idx}>
                    {c.idx}. {c.title.slice(0, 40)}
                  </option>
                ))}
              </select>
            </label>
            <label className="col" style={{ gap: 4 }}>
              <span className="small muted">To chapter</span>
              <select value={to} onChange={(e) => { setTo(Number(e.target.value)); setPlan(null); }}>
                {chapters.map((c) => (
                  <option key={c.idx} value={c.idx}>
                    {c.idx}. {c.title.slice(0, 40)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <span className="small muted">Modes</span>
        <Checks names={MODE_NAMES} value={modes} onChange={(v) => { setModes(v); setPlan(null); }} />
        <span className="small muted">English levels</span>
        <Checks names={LEVEL_NAMES} value={levels} onChange={(v) => { setLevels(v); setPlan(null); }} />
        <span className="small muted">Languages</span>
        <Checks names={LANG_NAMES} value={langs} onChange={(v) => { setLangs(v); setPlan(null); }} />
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={audio} onChange={(e) => { setAudio(e.target.checked); setPlan(null); }} />
          <span>Also make the narration (uses the voices set in Narrator voice)</span>
        </label>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={freePart} onChange={(e) => { setFreePart(e.target.checked); setPlan(null); }} />
          <span>Also the free-preview version of chapter 1 (what free learners hear when chapter 1 is longer than 7 pages)</span>
        </label>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn small ghost" onClick={makePlan} disabled={(many ? !pickedIds.length : !bookId) || running}>
            Check what it will cost
          </button>
          {plan && !running && (
            <button className="btn small" onClick={run} disabled={!plan.lessonsToMake && !plan.audioToMake}>
              Create {plan.total} version{plan.total === 1 ? '' : 's'}
            </button>
          )}
          {running && (
            <button className="btn small ghost" onClick={() => (stop.current = true)}>
              Stop
            </button>
          )}
        </div>
        {plan && (
          <p className="small" style={{ margin: 0 }}>
            {plan.total} versions: {plan.lessonsToMake} lessons to write{audio ? ` and ${plan.audioToMake} narrations to record` : ''}. Estimated cost: <b>about ₹{plan.estimateInr}</b> (a rough guide; actual cost shows in Usage &amp; costs). Time: about {Math.max(1, Math.round(((plan.lessonsToMake * 40 + plan.audioToMake * 20) / 2) / 60))} min.
          </p>
        )}
        {(running || done > 0) && plan && (
          <div className="bar" aria-label="Progress" style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
            <div style={{ width: `${Math.round((done / plan.total) * 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
          </div>
        )}
        {log.length > 0 && (
          <pre className="tiny" style={{ whiteSpace: 'pre-wrap', margin: 0, maxHeight: 320, overflow: 'auto' }}>
            {done}/{plan?.total} done{running ? '…' : ''}
            {'\n'}
            {log.join('\n')}
          </pre>
        )}
      </div>
    </section>
  );
}
