'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, fmtDate } from '@/lib/client';
import { useApp } from '@/components/AppProvider';
import { BottomNav, ErrorNote, Loading, TopBar } from '@/components/ui';

interface N {
  id: string;
  title: string;
  body: string;
  link: string | null;
  created_at: string;
}

export default function Notifications() {
  const { refresh } = useApp();
  const [list, setList] = useState<N[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ notifications: N[] }>('/api/notifications')
      .then((r) => {
        setList(r.notifications);
        refresh();
      })
      .catch((e) => setError(e.message));
  }, [refresh]);
  return (
    <main className="page">
      <TopBar back="/account" title="Notices" />
      <ErrorNote error={error} />
      {!list && !error && <Loading />}
      {list?.length === 0 && <p className="muted">No notices yet.</p>}
      {list?.map((n) => (
        <Link key={n.id} href={n.link || '/'} className="card col" style={{ textDecoration: 'none', color: 'var(--ink)', gap: 2 }}>
          <b>{n.title}</b>
          <span className="small">{n.body}</span>
          <span className="tiny muted">{fmtDate(n.created_at)}</span>
        </Link>
      ))}
      <BottomNav />
    </main>
  );
}
