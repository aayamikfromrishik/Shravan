'use client';
// Reads the lesson aloud with the phone's own voice (free).
// iPhone: websites can use the built-in and downloaded "Enhanced" voices, not Siri's own voice.
import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui';

type Lang = 'english' | 'hindi' | 'mix';
const RATES = [0.75, 1, 1.25, 1.5];
const DEVANAGARI = /[ऀ-ॿ]/;

function pickVoice(voices: SpeechSynthesisVoice[], hindi: boolean): SpeechSynthesisVoice | null {
  const score = (v: SpeechSynthesisVoice) =>
    (/(enhanced|premium|natural|neural)/i.test(v.name) ? 10 : 0) + (/google/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);
  const best = (list: SpeechSynthesisVoice[]) => (list.length ? [...list].sort((a, b) => score(b) - score(a))[0] : null);
  if (hindi) return best(voices.filter((v) => /^hi/i.test(v.lang)));
  return best(voices.filter((v) => /^en[-_]IN/i.test(v.lang))) || best(voices.filter((v) => /^en[-_](GB|US|AU)/i.test(v.lang))) || best(voices.filter((v) => /^en/i.test(v.lang)));
}

/** Plays sentences one after another; keeps its place so Play resumes from the same sentence. */
class Speaker {
  sentences: string[] = [];
  lang: Lang = 'english';
  voices: SpeechSynthesisVoice[] = [];
  rate = 1;
  index = 0;
  playing = false;
  onChange: (index: number, playing: boolean) => void = () => {};

  speak(i: number) {
    const synth = window.speechSynthesis;
    if (i >= this.sentences.length) {
      this.playing = false;
      this.index = 0;
      this.onChange(this.sentences.length - 1, false);
      return;
    }
    this.index = i;
    this.onChange(i, true);
    const text = this.sentences[i];
    const hindi = this.lang === 'hindi' || (this.lang === 'mix' && DEVANAGARI.test(text));
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(this.voices, hindi);
    if (v) u.voice = v;
    u.lang = v?.lang || (hindi ? 'hi-IN' : 'en-IN');
    u.rate = this.rate;
    u.onend = () => {
      if (this.playing && this.index === i) this.speak(i + 1);
    };
    u.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled' && this.playing && this.index === i) this.speak(i + 1);
    };
    synth.speak(u);
  }
  play() {
    window.speechSynthesis.cancel();
    this.playing = true;
    this.speak(this.index);
  }
  pause() {
    this.playing = false;
    window.speechSynthesis.cancel();
    this.onChange(this.index, false);
  }
  jump(delta: number) {
    const i = Math.min(Math.max(0, this.index + delta), this.sentences.length - 1);
    window.speechSynthesis.cancel();
    if (this.playing) this.speak(i);
    else {
      this.index = i;
      this.onChange(i, false);
    }
  }
  setRate(r: number) {
    this.rate = r;
    if (this.playing) {
      window.speechSynthesis.cancel();
      this.speak(this.index);
    }
  }
}

export default function Player({ sentences, lang, start = 0, onPosition }: { sentences: string[]; lang: Lang; start?: number; onPosition?: (i: number) => void }) {
  const [supported, setSupported] = useState(true);
  const [hasHindi, setHasHindi] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(Math.min(start, Math.max(0, sentences.length - 1)));
  const [rate, setRate] = useState(1);
  const speaker = useRef<Speaker | null>(null);
  const onPosRef = useRef(onPosition);

  useEffect(() => {
    onPosRef.current = onPosition;
  }, [onPosition]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setSupported(false);
      return;
    }
    const s = new Speaker();
    s.sentences = sentences;
    s.lang = lang;
    s.index = Math.min(start, Math.max(0, sentences.length - 1));
    try {
      const saved = Number(localStorage.getItem('shravan-rate'));
      if (RATES.includes(saved)) {
        s.rate = saved;
        setRate(saved);
      }
    } catch {}
    s.onChange = (i, p) => {
      setIndex(i);
      setPlaying(p);
      onPosRef.current?.(i);
    };
    const load = () => {
      s.voices = window.speechSynthesis.getVoices();
      setHasHindi(s.voices.length === 0 || s.voices.some((v) => /^hi/i.test(v.lang)));
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    // Phones stop speech when the screen locks; keep the place so Play resumes there.
    const onHide = () => {
      if (document.hidden && s.playing) s.pause();
    };
    document.addEventListener('visibilitychange', onHide);
    speaker.current = s;
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      document.removeEventListener('visibilitychange', onHide);
      s.playing = false;
      window.speechSynthesis.cancel();
    };
  }, [sentences, lang, start]);

  if (!supported) return <div className="note warn">This browser cannot read aloud. The lesson text is above.</div>;

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    speaker.current?.setRate(next);
    try {
      localStorage.setItem('shravan-rate', String(next));
    } catch {}
  };
  const pct = sentences.length ? Math.round(((index + (playing ? 0.5 : 0)) / sentences.length) * 100) : 0;

  return (
    <div className="player" aria-label="Lesson audio">
      <div className="bar" aria-hidden>
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="row between">
        <span className="tiny" style={{ color: 'var(--hero-muted)', minWidth: 52 }}>
          {index + 1} / {sentences.length}
        </span>
        <div className="row" style={{ gap: 12 }}>
          <button className="ctl" onClick={() => speaker.current?.jump(-1)} aria-label="Previous sentence">
            −1
          </button>
          <button className="play" onClick={() => (playing ? speaker.current?.pause() : speaker.current?.play())} aria-label={playing ? 'Pause' : 'Play'}>
            <Icon name={playing ? 'pause' : 'play'} size={22} />
          </button>
          <button className="ctl" onClick={() => speaker.current?.jump(1)} aria-label="Next sentence">
            +1
          </button>
        </div>
        <button className="ctl" onClick={cycleRate} aria-label="Playback speed">
          {rate}×
        </button>
      </div>
      {lang !== 'english' && !hasHindi && (
        <span className="tiny" style={{ color: 'var(--hero-muted)' }}>
          No Hindi voice on this phone yet. Add one in your phone&apos;s settings (Accessibility › Spoken content › Voices).
        </span>
      )}
    </div>
  );
}
