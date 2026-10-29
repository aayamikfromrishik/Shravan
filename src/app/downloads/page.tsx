'use client';
// Lessons saved on this phone. Works without internet.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Player from '@/components/Player';
import { TopBar } from '@/components/ui';
import { listOfflineLessons, offlineSupported, removeOfflineLesson, type OfflineLesson } from '@/lib/offline';
import { lessonSpeech, toSentences } from '@/lib/lesson';

const MODE_NAME: Record<string, string> = { key: 'Key Ideas', examples: 'Key Ideas + Examples', complete: 'Complete' };
const LANG_NAME: Record<string, string> = { english: 'English', hindi: 'हिन्दी', mix: 'Mix' };
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

function OfflineLessonView({ item, onClose }: { item: OfflineLesson; onClose: () => void }) {
  const sentences = useMemo(() => toSentences(lessonSpeech(item.lesson, item.lang)), [item]);
  const [urls] = useState(() => item.parts.map((p) => URL.createObjectURL(p.audio)));
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const parts = useMemo(() => item.parts.map((p, i) => ({ url: urls[i], start: p.start, end: p.end })), [item, urls]);
  const l = item.lesson;
  return (
    <main className="page">
      <TopBar title={item.bookTitle} right={<button className="linkbtn small" onClick={onClose}>All downloads</button>} />
      <div className="col">
        <span className="tiny muted">
          Chapter {item.chapterIdx} · {MODE_NAME[item.mode] || item.mode} · {LANG_NAME[item.lang]}
        </span>
        <h2 style={{ margin: 0 }}>{l.title}</h2>
        <div className="card">
          <p style={{ margin: 0 }}>{l.main_idea}</p>
        </div>
        {l.sections?.map((s, i) => (
          <div key={i} className="card col">
            <h3 style={{ margin: 0 }}>{s.heading}</h3>
            <p style={{ margin: 0 }}>{s.explanation}</p>
          </div>
        ))}
        {l.key_lessons?.length > 0 && (
          <div className="card col">
            <span className="tiny" style={{ color: 'var(--label)', fontWeight: 700, letterSpacing: '0.08em' }}>KEY LESSONS</span>
            {l.key_lessons.map((k, i) => (
              <p key={i} style={{ margin: 0 }}>
                {i + 1}. {k.text}
              </p>
            ))}
          </div>
        )}
        {l.examples?.length > 0 && (
          <div className="card col">
            <span className="tiny" style={{ color: 'var(--label)', fontWeight: 700, letterSpacing: '0.08em' }}>EXAMPLES</span>
            {l.examples.map((e, i) => (
              <p key={i} style={{ margin: 0 }}>
                {e.text}
              </p>
            ))}
          </div>
        )}
        <div className="card">
          <b>Takeaway: </b>
          {l.takeaway}
        </div>
        <div style={{ height: 120 }} />
      </div>
      <Player sentences={sentences} lang={item.lang} offlineParts={parts} />
    </main>
  );
}

export default function Downloads() {
  const [items, setItems] = useState<OfflineLesson[] | null>(null);
  const [open, setOpen] = useState<OfflineLesson | null>(null);
  const [online, setOnline] = useState(true);

  const load = () =>
    listOfflineLessons()
      .then((l) => setItems(l.sort((a, b) => a.bookTitle.localeCompare(b.bookTitle) || a.chapterIdx - b.chapterIdx)))
      .catch(() => setItems([]));
  useEffect(() => {
    if (offlineSupported()) load();
    else setItems([]);
    const upd = () => setOnline(navigator.onLine);
    upd();
    window.addEventListener('online', upd);
    window.addEventListener('offline', upd);
    return () => {
      window.removeEventListener('online', upd);
      window.removeEventListener('offline', upd);
    };
  }, []);

  if (open) return <OfflineLessonView item={open} onClose={() => setOpen(null)} />;
  const total = (items || []).reduce((a, i) => a + i.bytes, 0);
  return (
    <main className="page">
      <TopBar back={online ? '/' : undefined} title="Downloads" />
      {!online && <div className="note">You are offline. Your saved lessons still play.</div>}
      {items === null ? null : items.length === 0 ? (
        <div className="card col">
          <p style={{ margin: 0 }}>No lessons saved yet.</p>
          <p className="small muted" style={{ margin: 0 }}>
            Open a lesson and tap “Save for offline” (Premium) to listen without internet.
          </p>
          {online && <Link href="/mybooks">Go to My books</Link>}
        </div>
      ) : (
        <>
          <p className="tiny muted" style={{ margin: 0 }}>
            {items.length} lesson{items.length === 1 ? '' : 's'} · {mb(total)} on this phone
          </p>
          {items.map((it) => (
            <div key={it.versionId} className="card row between" style={{ gap: 8 }}>
              <button className="linkbtn" style={{ textAlign: 'left', flex: 1 }} onClick={() => setOpen(it)}>
                <b>{it.bookTitle}</b>
                <div className="small">
                  Chapter {it.chapterIdx}: {it.chapterTitle}
                </div>
                <div className="tiny muted">
                  {MODE_NAME[it.mode] || it.mode} · {LANG_NAME[it.lang]} · {mb(it.bytes)}
                </div>
              </button>
              <button
                className="linkbtn small"
                onClick={async () => {
                  await removeOfflineLesson(it.versionId);
                  load();
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
