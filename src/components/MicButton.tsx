'use client';
// Speak instead of typing, using the phone's own speech recognition (where the browser offers it).
import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui';

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};

export default function MicButton({ lang, onText, label = 'Answer by speaking' }: { lang: 'english' | 'hindi' | 'mix'; onText: (t: string) => void; label?: string }) {
  const [on, setOn] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const [Ctor, setCtor] = useState<(new () => Recognition) | null>(null);
  useEffect(() => {
    const W = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const C = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (C) setCtor(() => C);
  }, []);
  if (!Ctor) return null;

  const toggle = () => {
    if (on) {
      rec.current?.stop();
      return;
    }
    const r = new Ctor();
    r.lang = lang === 'english' ? 'en-IN' : 'hi-IN';
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const t = Array.from(e.results)
        .map((x) => x[0].transcript)
        .join(' ');
      if (t) onText(t);
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    setOn(true);
    r.start();
  };

  return (
    <button type="button" className="iconbtn" onClick={toggle} aria-label={on ? 'Stop listening' : label} aria-pressed={on} style={{ width: 52, height: 52, borderRadius: 26, background: on ? 'var(--accent)' : 'var(--surface)', color: on ? 'var(--accent-ink)' : 'var(--ink)' }}>
      <Icon name="mic" />
    </button>
  );
}
