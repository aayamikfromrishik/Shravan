'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { ErrorNote, Loading, Seg, TopBar } from '@/components/ui';

type Mode = 'key' | 'examples' | 'complete';
type Level = 'basic' | 'normal' | 'advanced';
type Lang = 'english' | 'hindi' | 'mix';

const MODES: { value: Mode; title: string; sub: string }[] = [
  { value: 'key', title: 'Key Ideas Only', sub: 'Main idea, key lessons, takeaway' },
  { value: 'examples', title: 'Key Ideas + Essential Examples', sub: 'Each lesson with the examples that make it stick' },
  { value: 'complete', title: 'Complete Learning Experience', sub: 'The chapter section by section, in depth' },
];

export default function SetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('examples');
  const [level, setLevel] = useState<Level>('normal');
  const [lang, setLang] = useState<Lang>('mix');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{
      book: { title: string };
      chapters: { id: string; idx: number }[];
      settings: { mode: Mode; level: Level; lang: Lang; current_chapter: number } | null;
      defaults: { mode: Mode; level: Level; lang: Lang };
    }>(`/api/books/${id}`)
      .then((d) => {
        setTitle(d.book.title);
        const s = d.settings || d.defaults;
        setMode(s.mode);
        setLevel(s.level);
        setLang(s.lang);
        const cur = d.settings?.current_chapter || 1;
        setChapterId((d.chapters.find((c) => c.idx === cur) || d.chapters[0])?.id ?? null);
        setReady(true);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const start = async () => {
    setBusy(true);
    try {
      await api(`/api/books/${id}/open`, { body: { mode, level, lang } });
      if (chapterId) router.push(`/learn/${chapterId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="page nonav">
      <TopBar back={`/book/${id}`} title={title} />
      <h1 style={{ fontSize: 24 }}>How would you like to learn?</h1>
      <ErrorNote error={error} />
      {!ready && !error && <Loading />}
      {ready && (
        <>
          <fieldset className="col" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="label" style={{ marginBottom: 8 }}>
              Learning mode
            </legend>
            {MODES.map((m) => (
              <label key={m.value} className={`option ${mode === m.value ? 'on' : ''}`}>
                <input type="radio" name="mode" checked={mode === m.value} onChange={() => setMode(m.value)} />
                <span className="col" style={{ gap: 0 }}>
                  <b>{m.title}</b>
                  <span className="small muted">{m.sub}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="col" style={{ gap: 8 }}>
            <span className="label">English level</span>
            <Seg label="English level" value={level} onChange={setLevel} options={[{ value: 'basic', label: 'Basic' }, { value: 'normal', label: 'Normal' }, { value: 'advanced', label: 'Advanced' }]} />
          </div>
          <div className="col" style={{ gap: 8 }}>
            <span className="label">Language</span>
            <Seg label="Language" value={lang} onChange={setLang} options={[{ value: 'english', label: 'English' }, { value: 'hindi', label: 'हिन्दी' }, { value: 'mix', label: 'Mix' }]} />
          </div>
          <div className="grow" />
          <p className="center muted small" style={{ margin: 0 }}>
            You can change any of these during the book.
          </p>
          <button className="btn" onClick={start} disabled={busy || !chapterId}>
            {busy ? 'Starting…' : 'Start learning'}
          </button>
        </>
      )}
    </main>
  );
}
