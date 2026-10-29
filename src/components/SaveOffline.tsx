'use client';
// "Save for offline" on a lesson (Premium): keeps the lesson text and its narration on this phone.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, supabase } from '@/lib/client';
import { isSavedOffline, offlineSupported, removeOfflineLesson, saveOfflineLesson } from '@/lib/offline';
import type { Lesson } from '@/lib/lesson';
import { useApp } from './AppProvider';

export default function SaveOffline(props: {
  versionId: string;
  book: { id: string; title: string };
  chapter: { id: string; idx: number; title: string };
  lang: 'english' | 'hindi' | 'mix';
  mode: string;
  lesson: Lesson;
}) {
  const { me } = useApp();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const premium = !!(me?.isSubscriber || me?.isAdmin);

  useEffect(() => {
    if (offlineSupported()) isSavedOffline(props.versionId).then(setSaved);
  }, [props.versionId]);

  if (!me?.aiVoice || !offlineSupported()) return null;

  const save = async () => {
    setNote(null);
    if (!premium) {
      setNote('premium');
      return;
    }
    try {
      setBusy('Preparing the narration…');
      let r: { status: string; parts?: { start: number; end: number }[]; voice?: string; reason?: string } = { status: 'generating' };
      for (let t = 0; t < 80 && r.status === 'generating'; t++) {
        r = await api(`/api/audio/${props.versionId}`, { method: 'POST' });
        if (r.status === 'generating') await new Promise((res) => setTimeout(res, 4000));
      }
      if (r.status !== 'ready' || !r.parts) throw new Error(r.reason || 'The narration is not available right now.');
      const { data } = await supabase().auth.getSession();
      const token = data.session?.access_token;
      const parts: { start: number; end: number; audio: Blob }[] = [];
      let bytes = 0;
      for (let i = 0; i < r.parts.length; i++) {
        setBusy(`Saving ${i + 1} of ${r.parts.length}…`);
        const res = await fetch(`/api/offline/${props.versionId}/${i}?voice=${encodeURIComponent(r.voice || '')}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Could not save the audio.');
        const audio = await res.blob();
        bytes += audio.size;
        parts.push({ start: r.parts[i].start, end: r.parts[i].end, audio });
      }
      await saveOfflineLesson({
        versionId: props.versionId,
        bookId: props.book.id,
        bookTitle: props.book.title,
        chapterId: props.chapter.id,
        chapterIdx: props.chapter.idx,
        chapterTitle: props.chapter.title,
        lang: props.lang,
        mode: props.mode,
        lesson: props.lesson,
        parts,
        bytes,
        savedAt: new Date().toISOString(),
      });
      setSaved(true);
    } catch (e) {
      setNote((e as Error).message);
    }
    setBusy(null);
  };
  const remove = async () => {
    await removeOfflineLesson(props.versionId);
    setSaved(false);
  };

  return (
    <div className="row between" style={{ gap: 8, flexWrap: 'wrap' }}>
      {saved ? (
        <>
          <span className="small">✓ Saved for offline listening</span>
          <span className="row" style={{ gap: 12 }}>
            <Link href="/downloads" className="small">
              Downloads
            </Link>
            <button className="linkbtn small" onClick={remove}>
              Remove
            </button>
          </span>
        </>
      ) : (
        <button className="btn small ghost" onClick={save} disabled={!!busy}>
          {busy || '⤓ Save for offline'}
          {!premium && !busy ? ' · Premium' : ''}
        </button>
      )}
      {note === 'premium' ? (
        <span className="small">
          Offline listening is part of SHRAVAN Premium. <Link href="/subscribe">See Premium</Link>
        </span>
      ) : (
        note && <span className="small" style={{ color: 'var(--bad)' }}>{note}</span>
      )}
    </div>
  );
}
