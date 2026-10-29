'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/client';
import { lessonSpeech, toSentences, type Lesson, type LessonExample } from '@/lib/lesson';
import { ErrorNote, Loading, Steps, TopBar } from '@/components/ui';
import Player from '@/components/Player';
import MicButton from '@/components/MicButton';

type Lang = 'english' | 'hindi' | 'mix';
interface Action {
  id: string;
  text: string;
  source: 'book' | 'shravan';
  because: string | null;
  is_first: boolean;
  done: boolean;
}
interface LearnResp {
  status: 'ready';
  book: { id: string; title: string; author: string | null; subject: string | null };
  chapter: { id: string; idx: number; title: string; count: number };
  next: { id: string; idx: number; title: string } | null;
  part: 'free' | 'full';
  settings: { mode: 'key' | 'examples' | 'complete'; level: string; lang: Lang };
  lesson: Lesson;
  versionId: string;
  removedQuotes: number;
  progress: { speech_position: number; quick_check: string | null; completed: boolean } | null;
  reflections: { q_index: number; question: string; answer: string | null; skipped: boolean }[];
  actions: Action[];
  canAsk: boolean;
  asksLeft: number;
}

const MODE_NAME = { key: 'Key Ideas', examples: 'Key Ideas + Examples', complete: 'Complete' };
const LEVEL_NAME: Record<string, string> = { basic: 'Basic', normal: 'Normal', advanced: 'Advanced' };
const LANG_NAME: Record<string, string> = { english: 'English', hindi: 'हिन्दी', mix: 'Mix' };

function OriginChip({ origin }: { origin: 'book' | 'teacher' }) {
  return origin === 'book' ? <span className="chip book">From the book</span> : <span className="chip">Teacher&apos;s example</span>;
}

function Snippet({ text }: { text?: string | null }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div>
      <button className="linkbtn" style={{ padding: '2px 0', fontSize: 13 }} onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? 'Hide' : 'See in the book'}
      </button>
      {open && (
        <blockquote className="small" style={{ margin: '4px 0 0', padding: '6px 10px', borderLeft: '3px solid var(--accent)', background: 'var(--bg)', borderRadius: 6 }}>
          “{text}”
        </blockquote>
      )}
    </div>
  );
}

function Example({ e }: { e: LessonExample }) {
  return (
    <div className="col" style={{ gap: 4 }}>
      <OriginChip origin={e.origin} />
      <span>{e.text}</span>
      <Snippet text={e.source_snippet} />
    </div>
  );
}

function icsFor(text: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d < new Date()) d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = (x: Date) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
  const end = new Date(d.getTime() + 10 * 60000);
  const safe = text.replace(/[,;\\]/g, ' ').replace(/\n/g, ' ');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SHRAVAN//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@shravan`,
    `DTSTART:${stamp(d)}`,
    `DTEND:${stamp(end)}`,
    'RRULE:FREQ=DAILY;COUNT=7',
    `SUMMARY:SHRAVAN: ${safe.slice(0, 120)}`,
    `DESCRIPTION:${safe}`,
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    'DESCRIPTION:SHRAVAN action',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export default function LearnPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = use(params);
  const router = useRouter();
  const [d, setD] = useState<LearnResp | null>(null);
  const [state, setState] = useState<'loading' | 'confirm' | 'locked' | 'generating' | 'failed' | 'ready'>('loading');
  const [lockReason, setLockReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'listen' | 'reflect' | 'apply' | 'done'>('listen');
  const [showText, setShowText] = useState(true);
  const confirmRef = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api<Omit<LearnResp, 'status'> & { status: string }>(`/api/learn/${chapterId}${confirmRef.current ? '?confirm=1' : ''}`);
      if (r.status === 'generating') {
        setState('generating');
        return;
      }
      setD(r as LearnResp);
      setState('ready');
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409) setState('confirm');
      else if (err.status === 402) {
        setLockReason((err.data as { reason?: string })?.reason || 'subscribe');
        setState('locked');
      } else if (err.status === 500 && (err.data as { status?: string })?.status === 'failed') setState('failed');
      else setError(err.message);
    }
  }, [chapterId]);

  useEffect(() => {
    load();
  }, [load]);

  // While the lesson is being written for the first time, check again every few seconds.
  useEffect(() => {
    if (state !== 'generating') return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [state, load]);

  useEffect(() => {
    try {
      const v = localStorage.getItem('shravan-showtext');
      if (v === '0') setShowText(false);
    } catch {}
  }, []);

  const sentences = useMemo(() => (d ? toSentences(lessonSpeech(d.lesson, d.settings.lang)) : []), [d]);
  const posTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePos = useCallback(
    (i: number) => {
      if (posTimer.current) clearTimeout(posTimer.current);
      posTimer.current = setTimeout(() => api(`/api/learn/${chapterId}/progress`, { body: { speech_position: i } }).catch(() => {}), 1500);
    },
    [chapterId],
  );

  if (error)
    return (
      <main className="page nonav">
        <TopBar back />
        <ErrorNote error={error} />
        <button className="btn" onClick={load}>
          Try again
        </button>
      </main>
    );
  if (state === 'loading') return <main className="page nonav"><TopBar back /><Loading text="Opening the chapter…" /></main>;
  if (state === 'generating')
    return (
      <main className="page nonav">
        <TopBar back />
        <Loading text="Writing this lesson for the first time. This takes up to a minute; after that it opens instantly for everyone." />
      </main>
    );
  if (state === 'failed')
    return (
      <main className="page nonav">
        <TopBar back />
        <div className="note bad">The lesson could not be written just now.</div>
        <button className="btn" onClick={load}>
          Try again
        </button>
      </main>
    );
  if (state === 'confirm')
    return (
      <main className="page nonav">
        <TopBar back />
        <h1 style={{ fontSize: 24 }}>Start the free part?</h1>
        <p style={{ margin: 0 }}>This book&apos;s free part is chapter 1 (up to 7 pages). Opening it uses one of your 5 free previews.</p>
        <button
          className="btn"
          onClick={() => {
            confirmRef.current = true;
            setState('loading');
            load();
          }}
        >
          Use a free preview
        </button>
        <Link href="/subscribe" className="btn ghost">
          See the subscription
        </Link>
      </main>
    );
  if (state === 'locked')
    return (
      <main className="page nonav">
        <TopBar back />
        <h1 style={{ fontSize: 24 }}>{lockReason === 'no_previews' ? 'You have used your 5 free previews' : 'This chapter is part of the subscription'}</h1>
        <p style={{ margin: 0 }} className="muted">
          Your reflections and actions so far are saved.
        </p>
        <Link href="/subscribe" className="btn">
          See what a subscription opens
        </Link>
      </main>
    );
  if (!d) return null;

  const { lesson, settings } = d;
  const spiritual = d.book.subject === 'spiritual';

  return (
    <main className="page nonav" style={{ paddingBottom: step === 'listen' ? 24 : undefined }}>
      <TopBar back={`/book/${d.book.id}`} right={<Steps step={step === 'done' ? 'apply' : step} />} />
      <div className="col" style={{ gap: 2 }}>
        <span className="small muted">
          {d.book.title} · Chapter {d.chapter.idx} of {d.chapter.count}
        </span>
        <h1 style={{ fontSize: 23 }}>{lesson.title || d.chapter.title}</h1>
        <span className="tiny muted">
          {MODE_NAME[settings.mode]} · {LEVEL_NAME[settings.level]} · {LANG_NAME[settings.lang]} ·{' '}
          <Link href={`/book/${d.book.id}/setup`}>Change</Link>
        </span>
      </div>

      {step === 'listen' && (
        <ListenView d={d} showText={showText} setShowText={setShowText} sentences={sentences} savePos={savePos} onNext={() => { setStep('reflect'); api(`/api/learn/${chapterId}/progress`, { body: { listened: true, step: 'reflect' } }).catch(() => {}); }} />
      )}
      {step === 'reflect' && <ReflectView d={d} spiritual={spiritual} onBack={() => setStep('listen')} onDone={() => setStep('apply')} />}
      {step === 'apply' && (
        <ApplyView
          d={d}
          spiritual={spiritual}
          onDone={async () => {
            const r = await api<{ next: { id: string } | null; finishedBook: boolean; partial: boolean }>(`/api/learn/${chapterId}/complete`, { body: {} });
            if (r.partial) router.push(`/subscribe?book=${d.book.id}`);
            else setStep('done');
          }}
        />
      )}
      {step === 'done' && (
        <div className="col">
          <div className="note good">Chapter {d.chapter.idx} complete. Your reflections and actions are saved.</div>
          {d.next ? (
            <Link href={`/learn/${d.next.id}`} className="btn">
              Go to chapter {d.next.idx}
            </Link>
          ) : (
            <Link href={`/book/${d.book.id}/plan`} className="btn accent">
              Your end-of-book action plan
            </Link>
          )}
          <Link href="/" className="btn ghost">
            Back to Home
          </Link>
        </div>
      )}
    </main>
  );
}

function ListenView({ d, showText, setShowText, sentences, savePos, onNext }: { d: LearnResp; showText: boolean; setShowText: (b: boolean) => void; sentences: string[]; savePos: (i: number) => void; onNext: () => void }) {
  const { lesson } = d;
  const [asks, setAsks] = useState<{ q: string; a: string; found: boolean }[]>([]);
  const [q, setQ] = useState('');
  const [asksLeft, setAsksLeft] = useState(d.asksLeft);
  const [asking, setAsking] = useState(false);
  const [askErr, setAskErr] = useState<string | null>(null);
  const [flagged, setFlagged] = useState(false);

  const ask = async (question: string) => {
    if (!question.trim()) return;
    setAsking(true);
    setAskErr(null);
    try {
      const r = await api<{ answer: string; found: boolean; asksLeft: number }>(`/api/learn/${d.chapter.id}/ask`, { body: { question } });
      setAsks((a) => [...a, { q: question, a: r.answer, found: r.found }]);
      setAsksLeft(r.asksLeft);
      setQ('');
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(r.answer);
        u.lang = /[ऀ-ॿ]/.test(r.answer) ? 'hi-IN' : 'en-IN';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    } catch (e) {
      setAskErr((e as Error).message);
    } finally {
      setAsking(false);
    }
  };

  const toggleText = () => {
    setShowText(!showText);
    try {
      localStorage.setItem('shravan-showtext', showText ? '0' : '1');
    } catch {}
  };

  return (
    <>
      {d.part === 'free' && <div className="note warn">This is the free part: the first 7 pages of chapter 1. SHRAVAN teaches only what these pages contain.</div>}
      {lesson.coverage_note && <div className="note warn">{lesson.coverage_note}</div>}
      {d.removedQuotes > 0 && (
        <p className="tiny muted" style={{ margin: 0 }}>
          {d.removedQuotes} item{d.removedQuotes > 1 ? 's were' : ' was'} left out because {d.removedQuotes > 1 ? 'they' : 'it'} could not be matched word for word with the book.
        </p>
      )}

      <div className="row between">
        <span className="label">Listen</span>
        <button className="btn small ghost" onClick={toggleText} aria-pressed={showText}>
          {showText ? 'Hide text' : 'Show text'}
        </button>
      </div>

      {showText && (
        <>
          <section className="card col" style={{ gap: 4 }}>
            <span className="label">Main idea</span>
            <p style={{ margin: 0, fontSize: 17 }}>{lesson.main_idea}</p>
          </section>
          {lesson.sections?.map((s, i) => (
            <section key={i} className="card col" style={{ gap: 6 }}>
              <span className="label">{s.heading}</span>
              <p style={{ margin: 0 }}>{s.explanation}</p>
              {s.examples?.map((e, j) => <Example key={j} e={e} />)}
            </section>
          ))}
          {lesson.key_lessons?.length > 0 && (
            <section className="card col" style={{ gap: 8 }}>
              <span className="label">Key lessons</span>
              {lesson.key_lessons.map((k, i) => (
                <div key={i} className="col" style={{ gap: 0 }}>
                  <span>
                    {i + 1}. {k.text}
                  </span>
                  <Snippet text={k.source_snippet} />
                </div>
              ))}
            </section>
          )}
          {lesson.examples?.length > 0 && (
            <section className="card col" style={{ gap: 10 }}>
              <span className="label">Examples</span>
              {lesson.examples.map((e, i) => <Example key={i} e={e} />)}
            </section>
          )}
          {lesson.quotes?.length > 0 && (
            <section className="card col" style={{ gap: 8 }}>
              <span className="label">In the book&apos;s words</span>
              {lesson.quotes.map((qq, i) => (
                <blockquote key={i} style={{ margin: 0, paddingLeft: 10, borderLeft: '3px solid var(--accent)' }}>
                  “{qq.text}”{qq.translation && <div className="small muted">{qq.translation}</div>}
                </blockquote>
              ))}
            </section>
          )}
          <section className="card col" style={{ gap: 4, borderColor: 'var(--accent)' }}>
            <span className="label">Key takeaway</span>
            <p style={{ margin: 0, fontWeight: 600 }}>{lesson.takeaway}</p>
          </section>
        </>
      )}

      <section className="card col">
        <span className="label">Ask about this chapter</span>
        {d.canAsk ? (
          <>
            {asks.map((a, i) => (
              <div key={i} className="col" style={{ gap: 4 }}>
                <span className="small muted">You: {a.q}</span>
                <span>{a.a}</span>
              </div>
            ))}
            <ErrorNote error={askErr} />
            {asksLeft > 0 ? (
              <>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn small ghost" disabled={asking} onClick={() => ask('Please explain the main idea more simply.')}>
                    Simpler
                  </button>
                  <button className="btn small ghost" disabled={asking} onClick={() => ask('Give me another example of the main idea from this chapter.')}>
                    Another example
                  </button>
                  <button className="btn small ghost" disabled={asking} onClick={() => ask('Explain the main idea in Hindi.')}>
                    Explain in Hindi
                  </button>
                </div>
                <form
                  className="row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    ask(q);
                  }}
                >
                  <MicButton lang={d.settings.lang} onText={(t) => setQ(t)} label="Ask by speaking" />
                  <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type your question" aria-label="Your question" />
                  <button className="btn small" disabled={asking || q.trim().length < 3}>
                    {asking ? '…' : 'Ask'}
                  </button>
                </form>
                <span className="tiny muted">{asksLeft} questions left for this chapter · answered only from the chapter</span>
              </>
            ) : (
              <span className="small muted">You have used all the questions for this chapter.</span>
            )}
          </>
        ) : (
          <span className="small muted">
            Asking questions is part of the <Link href="/subscribe">subscription</Link>.
          </span>
        )}
      </section>

      <div className="row between">
        {!flagged ? (
          <button
            className="linkbtn tiny"
            onClick={async () => {
              const note = prompt('What looks wrong in this lesson?') || '';
              await api(`/api/learn/${d.chapter.id}/flag`, { body: { versionId: d.versionId, note } }).catch(() => {});
              setFlagged(true);
            }}
          >
            Report a problem
          </button>
        ) : (
          <span className="tiny muted">Thanks, reported.</span>
        )}
      </div>

      <button className="btn accent" onClick={onNext}>
        Next: Reflect
      </button>
      <Player sentences={sentences} lang={d.settings.lang} start={d.progress?.speech_position || 0} onPosition={savePos} versionId={d.versionId} />
    </>
  );
}

function ReflectView({ d, spiritual, onBack, onDone }: { d: LearnResp; spiritual: boolean; onBack: () => void; onDone: () => void }) {
  const qc = d.lesson.quick_check;
  const [checkDone, setCheckDone] = useState(!!d.progress?.quick_check || !qc?.question);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<'right' | 'missed' | null>(null);
  const questions = d.lesson.reflection_questions || [];
  const [qi, setQi] = useState(0);
  const existing = (i: number) => d.reflections.find((r) => r.q_index === i)?.answer || '';
  const [answer, setAnswer] = useState(existing(0));
  const [saving, setSaving] = useState(false);

  const saveCheck = (r: 'right' | 'missed' | 'skipped') => api(`/api/learn/${d.chapter.id}/progress`, { body: { quick_check: r } }).catch(() => {});

  const save = async (skipped: boolean) => {
    setSaving(true);
    await api(`/api/learn/${d.chapter.id}/reflect`, { body: { q_index: qi, question: questions[qi], answer, skipped } }).catch(() => {});
    setSaving(false);
    if (qi + 1 < questions.length) {
      setQi(qi + 1);
      setAnswer(existing(qi + 1));
    } else {
      api(`/api/learn/${d.chapter.id}/progress`, { body: { step: 'apply' } }).catch(() => {});
      onDone();
    }
  };

  if (!checkDone) {
    return (
      <section className="col">
        <span className="label">Quick check (optional)</span>
        <h2 style={{ fontSize: 20 }}>{qc.question}</h2>
        {qc.options.map((o, i) => (
          <label key={i} className={`option ${picked === i ? 'on' : ''}`}>
            <input type="radio" name="qc" checked={picked === i} onChange={() => setPicked(i)} disabled={!!result} />
            <span>{o}</span>
          </label>
        ))}
        {result === 'right' && <div className="note good">Yes, that&apos;s the heart of it.</div>}
        {result === 'missed' && (
          <div className="note warn">
            <b>Here it is more simply:</b> {qc.simpler_explanation}
          </div>
        )}
        {!result ? (
          <>
            <button
              className="btn"
              disabled={picked === null}
              onClick={() => {
                const r = picked === qc.answer_index ? 'right' : 'missed';
                setResult(r);
                saveCheck(r);
              }}
            >
              Check
            </button>
            <button
              className="linkbtn"
              onClick={() => {
                saveCheck('skipped');
                setCheckDone(true);
              }}
            >
              Skip (saved to revisit later)
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => setCheckDone(true)}>
            Continue to reflection
          </button>
        )}
        <button className="linkbtn" onClick={onBack}>
          Back to the lesson
        </button>
      </section>
    );
  }

  if (!questions.length) {
    onDone();
    return null;
  }

  return (
    <section className="col">
      <div className="row" style={{ gap: 6 }} aria-label={`Question ${qi + 1} of ${questions.length}`}>
        {questions.map((_, i) => (
          <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= qi ? 'var(--primary)' : 'var(--border)' }} />
        ))}
      </div>
      <span className="label">
        Question {qi + 1} of {questions.length}
      </span>
      <h2 style={{ fontSize: 21, lineHeight: 1.35 }}>{questions[qi]}</h2>
      <label className="col" style={{ gap: 6 }}>
        <span className="small muted">Your answer (only you can see this)</span>
        <textarea rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)} />
      </label>
      <div className="row">
        <MicButton lang={d.settings.lang} onText={(t) => setAnswer((a) => (a ? a + ' ' : '') + t)} />
        <button className="btn grow" onClick={() => save(false)} disabled={saving || !answer.trim()}>
          {saving ? 'Saving…' : 'Save and continue'}
        </button>
      </div>
      <button className="linkbtn" onClick={() => save(true)} disabled={saving}>
        Skip this question
      </button>
      <p className="center muted small" style={{ margin: 0 }}>
        {spiritual ? 'Your reflections are private. ' : ''}Saved to your private journal. Never shared, never shown to anyone. You can delete it any time.
      </p>
    </section>
  );
}

function ApplyView({ d, spiritual, onDone }: { d: LearnResp; spiritual: boolean; onDone: () => Promise<void> }) {
  const [actions, setActions] = useState<Action[] | null>(null);
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState('20:00');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ actions: Action[] }>(`/api/learn/${d.chapter.id}/actions`, { body: {} })
      .then((r) => {
        setActions(r.actions);
        setFirst(r.actions.find((a) => a.is_first)?.id || r.actions.find((a) => a.source === 'shravan')?.id || r.actions[0]?.id || null);
      })
      .catch((e) => setError(e.message));
  }, [d.chapter.id]);

  if (error) return <ErrorNote error={error} />;
  if (!actions) return <Loading text="Building your actions from this chapter and your answers…" />;
  const chosen = actions.find((a) => a.id === first);

  const finish = async () => {
    setBusy(true);
    if (first) await api(`/api/actions/${first}`, { method: 'PATCH', body: { is_first: true } }).catch(() => {});
    await onDone().catch((e) => setError((e as Error).message));
    setBusy(false);
  };

  return (
    <section className="col">
      <h2 style={{ fontSize: 22 }}>{spiritual ? 'What I’ll carry into my day' : `Your actions for chapter ${d.chapter.idx}`}</h2>
      <span className="muted">Pick one to start with.</span>
      {actions.map((a) => (
        <label key={a.id} className={`option ${first === a.id ? 'on' : ''}`}>
          <input type="radio" name="first" checked={first === a.id} onChange={() => setFirst(a.id)} />
          <span className="col" style={{ gap: 4 }}>
            {a.source === 'book' ? <span className="chip book" style={{ alignSelf: 'flex-start' }}>From the book</span> : <span className="chip" style={{ alignSelf: 'flex-start' }}>Suggested by SHRAVAN</span>}
            <span>{a.text}</span>
            {a.because && <span className="small muted">{a.because}</span>}
          </span>
        </label>
      ))}
      {chosen && (
        <div className="card row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <label className="row small" style={{ gap: 8 }}>
            Remind me daily at
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: 'auto', padding: '6px 8px' }} />
          </label>
          <a
            className="btn small ghost"
            download="shravan-action.ics"
            href={`data:text/calendar;charset=utf-8,${encodeURIComponent(icsFor(chosen.text, time))}`}
            onClick={() => api(`/api/actions/${chosen.id}`, { method: 'PATCH', body: { remind_at: time } }).catch(() => {})}
          >
            Add to my calendar
          </a>
        </div>
      )}
      <button className="btn" onClick={finish} disabled={busy}>
        {busy ? 'Saving…' : 'Make this my first action'}
      </button>
    </section>
  );
}
