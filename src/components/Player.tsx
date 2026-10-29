'use client';
// Reads the lesson aloud. Two voices:
// - Narrator: natural AI voice (Sarvam). Made once per lesson version, saved, then streamed to everyone.
// - Phone voice: the device's own speech (free), used when the narrator is off or unavailable.
// iPhone: websites can use the built-in and downloaded "Enhanced" voices, not Siri's own voice.
import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui';
import { api } from '@/lib/client';
import { useApp } from './AppProvider';

type Lang = 'english' | 'hindi' | 'mix';
type Engine = 'narrator' | 'phone';
const RATES = [0.75, 1, 1.25, 1.5];
const DEVANAGARI = /[ऀ-ॿ]/;

interface Engine_ {
  index: number;
  playing: boolean;
  onChange: (index: number, playing: boolean) => void;
  play(): void;
  pause(): void;
  jump(delta: number): void;
  setRate(r: number): void;
  destroy(): void;
}

// ---------------------------------------------------------------- phone voice
function pickVoice(voices: SpeechSynthesisVoice[], hindi: boolean): SpeechSynthesisVoice | null {
  // Natural / online voices sound far better than the old offline ones some devices offer first.
  const score = (v: SpeechSynthesisVoice) =>
    (/(enhanced|premium|natural|neural|online)/i.test(v.name) ? 10 : 0) +
    (/google/i.test(v.name) ? 6 : 0) +
    (v.localService ? 0 : 2) -
    (/(heera|kalpana|hemant)/i.test(v.name) ? 8 : 0) +
    (!hindi && /^en[-_]IN/i.test(v.lang) ? 3 : 0);
  const list = voices.filter((v) => (hindi ? /^hi/i.test(v.lang) : /^en/i.test(v.lang)));
  return list.length ? [...list].sort((a, b) => score(b) - score(a))[0] : null;
}

class PhoneSpeaker implements Engine_ {
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
  destroy() {
    this.playing = false;
    window.speechSynthesis.cancel();
  }
}

// ---------------------------------------------------------------- narrator (saved audio)
interface Part {
  url: string;
  start: number;
  end: number;
}

class NarratorSpeaker implements Engine_ {
  audio = new Audio();
  parts: Part[] = [];
  sentences: string[] = [];
  index = 0;
  playing = false;
  rate = 1;
  partIdx = -1;
  onChange: (index: number, playing: boolean) => void = () => {};
  onBlocked: () => void = () => {};

  constructor() {
    this.audio.preload = 'auto';
    this.audio.addEventListener('timeupdate', () => this.track());
    this.audio.addEventListener('ended', () => this.next());
  }
  // Where a sentence sits inside its part, as a share of the part's length (by characters).
  private share(p: Part, i: number) {
    let before = 0;
    let total = 0;
    for (let k = p.start; k <= p.end; k++) {
      const n = (this.sentences[k] || '').length + 1;
      if (k < i) before += n;
      total += n;
    }
    return total ? before / total : 0;
  }
  private partFor(i: number) {
    const n = this.parts.findIndex((p) => i >= p.start && i <= p.end);
    return n < 0 ? 0 : n;
  }
  private track() {
    const p = this.parts[this.partIdx];
    if (!p || !this.audio.duration) return;
    const at = this.audio.currentTime / this.audio.duration;
    let i = p.start;
    const last = Math.min(p.end, this.sentences.length - 1);
    for (let k = p.start; k <= last; k++) if (this.share(p, k) <= at) i = k;
    if (i !== this.index) {
      this.index = i;
      this.onChange(i, this.playing);
    }
  }
  private next() {
    if (this.partIdx + 1 < this.parts.length) {
      this.index = this.parts[this.partIdx + 1].start;
      this.load(this.index, true);
    } else {
      this.playing = false;
      this.index = 0;
      this.partIdx = -1;
      this.onChange(this.sentences.length - 1, false);
    }
  }
  private load(i: number, autoplay: boolean) {
    const n = this.partFor(i);
    const p = this.parts[n];
    const seek = () => {
      if (this.audio.duration) this.audio.currentTime = this.share(p, i) * this.audio.duration;
      this.audio.playbackRate = this.rate;
      if (autoplay) {
        this.audio.play().catch(() => {
          // Some phones block sound that does not start from a tap.
          this.playing = false;
          this.onChange(this.index, false);
          this.onBlocked();
        });
      }
    };
    if (n !== this.partIdx) {
      this.partIdx = n;
      this.audio.src = p.url;
      this.audio.addEventListener('loadedmetadata', seek, { once: true });
      this.audio.load();
    } else seek();
    this.onChange(i, autoplay);
  }
  play() {
    if (!this.parts.length) return;
    this.playing = true;
    this.load(this.index, true);
  }
  pause() {
    this.playing = false;
    this.audio.pause();
    this.onChange(this.index, false);
  }
  jump(delta: number) {
    this.index = Math.min(Math.max(0, this.index + delta), this.sentences.length - 1);
    if (this.playing) this.load(this.index, true);
    else this.onChange(this.index, false);
  }
  setRate(r: number) {
    this.rate = r;
    this.audio.playbackRate = r;
  }
  destroy() {
    this.playing = false;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }
}

// ---------------------------------------------------------------- the player
export default function Player({
  sentences,
  lang,
  start = 0,
  onPosition,
  versionId,
  offlineParts,
}: {
  sentences: string[];
  lang: Lang;
  start?: number;
  onPosition?: (i: number) => void;
  versionId?: string;
  /** Saved audio (Downloads page): play these, no internet needed. */
  offlineParts?: Part[];
}) {
  const { me } = useApp();
  const narratorAllowed = !!offlineParts || !!(me?.aiVoice && versionId);
  const [engine, setEngine] = useState<Engine>(() => {
    try {
      if (localStorage.getItem('shravan-voice') === 'phone') return 'phone';
    } catch {}
    return 'narrator';
  });
  const useNarrator = !!offlineParts || (engine === 'narrator' && narratorAllowed);
  const [phoneOk, setPhoneOk] = useState(true);
  const [hasHindi, setHasHindi] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(Math.min(start, Math.max(0, sentences.length - 1)));
  const [rate, setRate] = useState(1);
  const [fallback, setFallback] = useState<string | null>(null);
  const [narr, setNarr] = useState<{ state: 'idle' | 'loading' | 'ready' | 'unavailable'; note?: string }>({ state: 'idle' });
  const speaker = useRef<Engine_ | null>(null);
  const onPosRef = useRef(onPosition);
  const indexRef = useRef(index);
  const cancelled = useRef(false);

  useEffect(() => {
    onPosRef.current = onPosition;
  }, [onPosition]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Build the voice engine (and rebuild it when the voice or the lesson changes).
  useEffect(() => {
    let savedRate = 1;
    try {
      const r = Number(localStorage.getItem('shravan-rate'));
      if (RATES.includes(r)) savedRate = r;
    } catch {}
    setRate(savedRate);
    const onChange = (i: number, p: boolean) => {
      setIndex(i);
      setPlaying(p);
      onPosRef.current?.(i);
    };
    const startAt = Math.min(indexRef.current, Math.max(0, sentences.length - 1));
    cancelled.current = false;

    if (useNarrator) {
      const n = new NarratorSpeaker();
      n.sentences = sentences;
      n.index = startAt;
      n.rate = savedRate;
      n.onChange = onChange;
      n.onBlocked = () => setNarr({ state: 'ready', note: 'Tap Play to start the narrator.' });
      speaker.current = n;
      if (offlineParts) n.parts = offlineParts;
      setNarr({ state: offlineParts ? 'ready' : 'idle' });
      return () => {
        cancelled.current = true;
        n.destroy();
      };
    }

    if (!('speechSynthesis' in window)) {
      setPhoneOk(false);
      return;
    }
    const s = new PhoneSpeaker();
    s.sentences = sentences;
    s.lang = lang;
    s.index = startAt;
    s.rate = savedRate;
    s.onChange = onChange;
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
      s.destroy();
    };
  }, [sentences, lang, useNarrator, offlineParts]);

  // Narrator not available: carry on with the phone voice (just for now; the choice is not saved).
  const fallBackToPhone = (why: string) => {
    setNarr({ state: 'unavailable' });
    setFallback(`${why} Using the phone voice. Tap Play.`);
    setEngine('phone');
  };

  // Ask the server for the narration; the first listener of a lesson waits while it is made.
  const loadNarration = async (): Promise<boolean> => {
    setNarr({ state: 'loading' });
    for (let tries = 0; tries < 80 && !cancelled.current; tries++) {
      try {
        const r = await api<{ status: string; parts?: Part[]; reason?: string }>(`/api/audio/${versionId}`, { method: 'POST' });
        if (r.status === 'ready' && r.parts?.length) {
          const n = speaker.current as NarratorSpeaker;
          n.parts = r.parts;
          setNarr({ state: 'ready' });
          return true;
        }
        if (r.status !== 'generating') {
          fallBackToPhone(r.reason || 'The narrator is not available right now.');
          return false;
        }
      } catch (e) {
        fallBackToPhone((e as Error).message);
        return false;
      }
      await new Promise((res) => setTimeout(res, 4000));
    }
    return false;
  };

  const onPlay = async () => {
    const s = speaker.current;
    if (!s) return;
    if (playing) return s.pause();
    if (useNarrator && narr.state !== 'ready') {
      if (narr.state === 'loading') return;
      const ok = await loadNarration();
      if (!ok) return;
    }
    speaker.current?.play();
  };

  const switchTo = (e: Engine) => {
    speaker.current?.pause();
    setFallback(null);
    setEngine(e);
    try {
      localStorage.setItem('shravan-voice', e);
    } catch {}
  };

  if (!useNarrator && !phoneOk) return <div className="note warn">This browser cannot read aloud. The lesson text is above.</div>;

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    speaker.current?.setRate(next);
    try {
      localStorage.setItem('shravan-rate', String(next));
    } catch {}
  };
  const pct = sentences.length ? Math.round(((index + (playing ? 0.5 : 0)) / sentences.length) * 100) : 0;
  const loading = useNarrator && narr.state === 'loading';

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
          <button className="play" onClick={onPlay} aria-label={playing ? 'Pause' : loading ? 'Preparing' : 'Play'} disabled={loading}>
            {loading ? <span className="tiny">…</span> : <Icon name={playing ? 'pause' : 'play'} size={22} />}
          </button>
          <button className="ctl" onClick={() => speaker.current?.jump(1)} aria-label="Next sentence">
            +1
          </button>
        </div>
        <button className="ctl" onClick={cycleRate} aria-label="Playback speed">
          {rate}×
        </button>
      </div>
      {narratorAllowed && !offlineParts && (
        <div className="row between" style={{ gap: 8 }}>
          <span className="tiny" style={{ color: 'var(--hero-muted)' }}>
            {loading
              ? 'Preparing the narrator… first time only, about 30 seconds.'
              : useNarrator && narr.note
                ? narr.note
                : useNarrator
                  ? 'Narrator voice'
                  : fallback || 'Phone voice'}
          </span>
          <button className="linkbtn tiny" style={{ color: 'var(--hero-muted)' }} onClick={() => switchTo(useNarrator ? 'phone' : 'narrator')}>
            {useNarrator ? 'Use phone voice' : 'Use narrator'}
          </button>
        </div>
      )}
      {!useNarrator && lang !== 'english' && !hasHindi && (
        <span className="tiny" style={{ color: 'var(--hero-muted)' }}>
          No Hindi voice on this phone yet. Add one in your phone&apos;s settings (Accessibility › Spoken content › Voices).
        </span>
      )}
    </div>
  );
}
