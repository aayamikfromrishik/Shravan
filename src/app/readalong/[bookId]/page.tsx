'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, use, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client';
import { ErrorNote, Loading, TopBar } from '@/components/ui';
import MicButton from '@/components/MicButton';

type Lang = 'english' | 'hindi' | 'mix';
interface RA {
  book: { id: string; title: string; author: string | null };
  chapter: { id: string; idx: number; title: string };
  access: string;
  previewsLeft: number;
  turns: { role: 'learner' | 'shravan'; text: string }[];
  followUpsLeft: number;
  reflectionQuestions: string[];
  lang: Lang;
}

function Inner({ bookId }: { bookId: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const idx = Number(sp.get('chapter') || 1);
  const [d, setD] = useState<RA | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<'talk' | 'reflect' | 'apply' | 'done'>('talk');
  const [qi, setQi] = useState(0);
  const [answer, setAnswer] = useState('');
  const [actions, setActions] = useState<{ id: string; text: string; because: string | null }[] | null>(null);

  const load = useCallback(() => {
    api<RA>(`/api/readalong/${bookId}?chapter=${idx}`)
      .then(setD)
      .catch((e) => setError(e.message));
  }, [bookId, idx]);
  useEffect(load, [load]);

  const send = async () => {
    if (!d || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ reply: string; followUpsLeft: number }>(`/api/readalong/${bookId}`, { body: { chapterId: d.chapter.id, text, confirmPreview: d.access === 'preview_needed' } });
      setD({ ...d, access: d.access === 'preview_needed' ? 'free_part' : d.access, turns: [...d.turns, { role: 'learner', text }, { role: 'shravan', text: r.reply }], followUpsLeft: r.followUpsLeft });
      setText('');
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const saveReflection = async (skipped: boolean) => {
    if (!d) return;
    setBusy(true);
    await api(`/api/learn/${d.chapter.id}/reflect`, { body: { q_index: qi, question: d.reflectionQuestions[qi], answer, skipped } }).catch(() => {});
    setBusy(false);
    setAnswer('');
    if (qi + 1 < d.reflectionQuestions.length) setQi(qi + 1);
    else {
      setStage('apply');
      api<{ actions: { id: string; text: string; because: string | null }[] }>(`/api/learn/${d.chapter.id}/actions`, { body: {} })
        .then((r) => setActions(r.actions))
        .catch((e) => setError(e.message));
    }
  };

  const finish = async (firstId?: string) => {
    if (!d) return;
    if (firstId) await api(`/api/actions/${firstId}`, { method: 'PATCH', body: { is_first: true } }).catch(() => {});
    await api(`/api/learn/${d.chapter.id}/complete`, { body: {} }).catch(() => {});
    setStage('done');
  };

  if (error && !d) return <><TopBar back="/mybooks" /><ErrorNote error={error} /></>;
  if (!d) return <Loading />;
  if (d.access === 'locked')
    return (
      <>
        <TopBar back="/mybooks" title={d.book.title} />
        <h1 style={{ fontSize: 22 }}>Chapter {d.chapter.idx} is part of the subscription</h1>
        <Link href="/subscribe" className="btn">
          See what a subscription opens
        </Link>
      </>
    );

  return (
    <>
      <TopBar back="/mybooks" title={`${d.book.title} · Read-along`} />
      <div className="col" style={{ gap: 0 }}>
        <span className="label">Read-along · Chapter {d.chapter.idx}</span>
        <h1 style={{ fontSize: 22 }}>{d.book.title}</h1>
      </div>
      <div className="note warn">Working from your notes, not the book&apos;s text. SHRAVAN doesn&apos;t claim to know what the book says.</div>
      <ErrorNote error={error} />

      {stage === 'talk' && (
        <>
          {d.turns.length === 0 && <p className="muted" style={{ margin: 0 }}>Read chapter {d.chapter.idx}, then tell SHRAVAN what you understood, in your own words.</p>}
          {d.turns.map((t, i) => (
            <div
              key={i}
              className="col"
              style={{
                alignSelf: t.role === 'learner' ? 'flex-end' : 'flex-start',
                maxWidth: '86%',
                gap: 2,
                padding: '10px 14px',
                borderRadius: t.role === 'learner' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: t.role === 'learner' ? 'var(--primary)' : 'var(--surface)',
                color: t.role === 'learner' ? 'var(--primary-ink)' : 'var(--ink)',
                border: t.role === 'learner' ? 'none' : '1px solid var(--border)',
              }}
            >
              <span className="tiny" style={{ fontWeight: 700, opacity: 0.8 }}>{t.role === 'learner' ? (i === 0 ? 'My notes' : 'Me') : 'SHRAVAN'}</span>
              <span>{t.text}</span>
            </div>
          ))}
          {d.access === 'preview_needed' && <p className="small muted" style={{ margin: 0 }}>Your first message uses one of your {d.previewsLeft} free previews.</p>}
          {d.followUpsLeft > 0 || d.turns.length === 0 ? (
            <div className="row">
              <MicButton lang={d.lang} onText={(t) => setText((x) => (x ? x + ' ' : '') + t)} label="Speak your notes" />
              <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="What did you understand?" aria-label="Your notes" />
              <button className="btn small" onClick={send} disabled={busy || !text.trim()}>
                {busy ? '…' : 'Send'}
              </button>
            </div>
          ) : null}
          {d.turns.length > 0 && <span className="tiny muted center">{d.followUpsLeft} follow-ups left for this chapter</span>}
          {d.turns.length > 0 && (
            <button className="btn accent" onClick={() => setStage('reflect')}>
              Go to Reflect
            </button>
          )}
        </>
      )}

      {stage === 'reflect' && (
        <section className="col">
          <span className="label">
            Question {qi + 1} of {d.reflectionQuestions.length}
          </span>
          <h2 style={{ fontSize: 20 }}>{d.reflectionQuestions[qi]}</h2>
          <textarea rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="Your answer" />
          <div className="row">
            <MicButton lang={d.lang} onText={(t) => setAnswer((a) => (a ? a + ' ' : '') + t)} />
            <button className="btn grow" onClick={() => saveReflection(false)} disabled={busy || !answer.trim()}>
              Save and continue
            </button>
          </div>
          <button className="linkbtn" onClick={() => saveReflection(true)}>
            Skip this question
          </button>
        </section>
      )}

      {stage === 'apply' && (
        <section className="col">
          <h2 style={{ fontSize: 21 }}>Your actions</h2>
          {!actions ? (
            <Loading text="Building your actions from your notes and answers…" />
          ) : (
            <>
              {actions.map((a) => (
                <div key={a.id} className="card col" style={{ gap: 4 }}>
                  <span className="chip" style={{ alignSelf: 'flex-start' }}>
                    Suggested by SHRAVAN
                  </span>
                  <span>{a.text}</span>
                  {a.because && <span className="small muted">{a.because}</span>}
                </div>
              ))}
              <button className="btn" onClick={() => finish(actions[0]?.id)}>
                Save and finish this chapter
              </button>
            </>
          )}
        </section>
      )}

      {stage === 'done' && (
        <div className="col">
          <div className="note good">Chapter {d.chapter.idx} saved.</div>
          <button className="btn" onClick={() => router.push(`/readalong/${bookId}?chapter=${d.chapter.idx + 1}`)}>
            Start chapter {d.chapter.idx + 1}
          </button>
          <Link href={`/book/${bookId}/plan`} className="btn ghost">
            Finished the book? Make my plan
          </Link>
        </div>
      )}
    </>
  );
}

export default function ReadAlongPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = use(params);
  return (
    <main className="page nonav">
      <Suspense fallback={<Loading />}>
        <Inner bookId={bookId} />
      </Suspense>
    </main>
  );
}
