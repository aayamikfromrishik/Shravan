'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, enablePush, supabase } from '@/lib/client';
import { useApp } from '@/components/AppProvider';
import { BottomNav, Loading, Seg } from '@/components/ui';

function Preview({ view }: { view: 'basic' | 'peacock' }) {
  const b = view === 'basic';
  return (
    <div aria-hidden style={{ height: 92, borderRadius: 10, background: b ? '#F8F5EF' : '#08272C', border: `1px solid ${b ? '#E3DED3' : '#1F5A63'}`, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ height: 8, width: '50%', background: b ? '#1B2340' : '#E6B954', borderRadius: 4 }} />
      <div style={{ height: 32, background: b ? '#1B2340' : '#0F3A41', borderRadius: 6, display: 'flex', alignItems: 'center', padding: 5 }}>
        <div style={{ height: 4, width: '40%', background: b ? '#E39B3B' : '#2FBF8F', borderRadius: 2 }} />
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        <div style={{ flex: 1, height: 16, background: b ? '#fff' : '#0F3A41', borderRadius: 4, borderTop: b ? '1px solid #E3DED3' : '2px solid #2FBF8F' }} />
        <div style={{ flex: 1, height: 16, background: b ? '#fff' : '#0F3A41', borderRadius: 4, borderTop: b ? '1px solid #E3DED3' : '2px solid #E6B954' }} />
      </div>
    </div>
  );
}

export default function Account() {
  const { me, setView, refresh } = useApp();
  const router = useRouter();
  const [pushState, setPushState] = useState<string | null>(null);
  if (!me) return <main className="page"><Loading /><BottomNav /></main>;
  const p = me.profile;

  const setDefault = async (k: string, v: string) => {
    await api('/api/me', { method: 'PATCH', body: { [k]: v } }).catch(() => {});
    refresh();
  };

  return (
    <main className="page">
      <h1 style={{ fontSize: 26 }}>Account</h1>
      <div className="card row between">
        <div className="col" style={{ gap: 0 }}>
          <b>{p.name || p.email}</b>
          <span className="small muted">
            {me.isAdmin ? 'Admin' : me.isSubscriber ? 'Subscriber' : `Free · ${me.previewsLeft} of 5 previews left`}
          </span>
        </div>
        {!me.isSubscriber && !me.isAdmin && (
          <Link href="/subscribe" className="btn small">
            Subscribe
          </Link>
        )}
      </div>

      <Link href="/notifications" className="card row between" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
        <span>Notices</span>
        {me.unread > 0 ? <span className="chip gold">{me.unread} new</span> : <span className="small muted">None new</span>}
      </Link>

      <fieldset className="col" style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>
          App view
        </legend>
        <div className="grid2">
          {(['basic', 'peacock'] as const).map((v) => (
            <label key={v} className={`option ${p.view === v ? 'on' : ''}`} style={{ flexDirection: 'column', gap: 8, padding: 10 }}>
              <Preview view={v} />
              <span className="row" style={{ gap: 8 }}>
                <input type="radio" name="view" checked={p.view === v} onChange={() => setView(v)} style={{ marginTop: 0 }} />
                <b>{v === 'basic' ? 'Basic' : 'Peacock'}</b>
              </span>
            </label>
          ))}
        </div>
        <span className="tiny muted">Changes the look only; your books and progress stay the same.</span>
      </fieldset>

      <div className="col" style={{ gap: 8 }}>
        <span className="label">Default language</span>
        <Seg label="Default language" value={p.default_language} onChange={(v) => setDefault('default_language', v)} options={[{ value: 'english', label: 'English' }, { value: 'hindi', label: 'हिन्दी' }, { value: 'mix', label: 'Mix' }]} />
        <span className="label" style={{ marginTop: 6 }}>
          Default English level
        </span>
        <Seg label="Default English level" value={p.default_level} onChange={(v) => setDefault('default_level', v)} options={[{ value: 'basic', label: 'Basic' }, { value: 'normal', label: 'Normal' }, { value: 'advanced', label: 'Advanced' }]} />
      </div>

      <div className="card col">
        <div className="row between">
          <span>Phone notifications</span>
          <button
            className="btn small ghost"
            onClick={async () => {
              const r = await enablePush();
              setPushState(r === 'ok' ? 'On' : r === 'denied' ? 'Blocked in your phone settings' : 'Not available here (on iPhone, add SHRAVAN to your Home Screen first)');
            }}
          >
            Turn on
          </button>
        </div>
        {pushState && <span className="small muted">{pushState}</span>}
        <span className="tiny muted">For when a book is made free for a few days.</span>
      </div>

      <div className="card col">
        <b>Your journal</b>
        <span className="small muted">Your reflection answers are private: never shared, never shown to anyone, never used to train anything.</span>
        <button
          className="btn danger small"
          style={{ alignSelf: 'flex-start' }}
          onClick={async () => {
            if (!confirm('Delete every journal answer, for good? Your actions stay.')) return;
            await api('/api/me', { method: 'DELETE' });
            alert('Your journal has been deleted.');
          }}
        >
          Delete my journal
        </button>
      </div>

      {me.isAdmin && (
        <Link href="/admin" className="btn ghost">
          Open Admin
        </Link>
      )}
      <button
        className="linkbtn"
        style={{ alignSelf: 'center' }}
        onClick={async () => {
          await supabase().auth.signOut();
          router.replace('/signin');
        }}
      >
        Sign out
      </button>
      <span className="center tiny muted" style={{ letterSpacing: '0.04em' }}>
        SHRAVAN by AAYAMIK
      </span>
      <BottomNav />
    </main>
  );
}
