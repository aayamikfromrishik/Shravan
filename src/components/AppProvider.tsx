'use client';
// Keeps the sign-in session and the learner's profile; applies the Basic / Peacock view.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { api, supabase } from '@/lib/client';

export interface Me {
  profile: {
    id: string;
    email: string | null;
    name: string | null;
    view: 'basic' | 'peacock';
    default_language: 'english' | 'hindi' | 'mix';
    default_level: 'basic' | 'normal' | 'advanced';
    default_mode: 'key' | 'examples' | 'complete';
    plan: 'free' | 'subscriber';
  };
  isAdmin: boolean;
  isSubscriber: boolean;
  previewsLeft: number;
  unread: number;
  paymentsEnabled: boolean;
  aiVoice?: boolean;
}

interface Ctx {
  session: Session | null;
  me: Me | null;
  ready: boolean;
  refresh: () => Promise<void>;
  setView: (v: 'basic' | 'peacock') => void;
}
const AppCtx = createContext<Ctx>({ session: null, me: null, ready: false, refresh: async () => {}, setView: () => {} });
export const useApp = () => useContext(AppCtx);

const PUBLIC = ['/signin'];

function applyView(v: string) {
  document.documentElement.dataset.view = v;
  try {
    localStorage.setItem('shravan-view', v);
  } catch {}
}

export default function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const path = usePathname();

  const refresh = useCallback(async () => {
    try {
      const m = await api<Me>('/api/me');
      setMe(m);
      applyView(m.profile.view);
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!session && !PUBLIC.includes(path)) {
      // Keep any message from a failed sign-in link so the sign-in page can show it.
      const extra = /error/.test(window.location.search + window.location.hash) ? window.location.search + window.location.hash : '';
      router.replace('/signin' + extra);
    }
    if (session) refresh();
  }, [ready, session, path, router, refresh]);

  const setView = useCallback(
    (v: 'basic' | 'peacock') => {
      applyView(v);
      setMe((m) => (m ? { ...m, profile: { ...m.profile, view: v } } : m));
      api('/api/me', { method: 'PATCH', body: { view: v } }).catch(() => {});
    },
    [],
  );

  return <AppCtx.Provider value={{ session, me, ready, refresh, setView }}>{children}</AppCtx.Provider>;
}
