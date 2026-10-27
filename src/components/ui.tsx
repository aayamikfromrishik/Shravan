'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from './AppProvider';

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'back':
      return <svg {...p}><path d="M15 5l-7 7 7 7" /></svg>;
    case 'close':
      return <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case 'search':
      return <svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>;
    case 'home':
      return <svg {...p}><path d="M4 11l8-6 8 6v8a1 1 0 01-1 1h-4v-5h-6v5H5a1 1 0 01-1-1v-8z" /></svg>;
    case 'books':
      return <svg {...p}><path d="M5 4h10a2 2 0 012 2v14H7a2 2 0 01-2-2V4z" /><path d="M5 18a2 2 0 012-2h10" /></svg>;
    case 'check':
      return <svg {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 12l3 3 5-6" /></svg>;
    case 'user':
      return <svg {...p}><circle cx="12" cy="9" r="4" /><path d="M4.5 20c1.2-3.5 4-5 7.5-5s6.3 1.5 7.5 5" /></svg>;
    case 'plus':
      return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
    case 'mic':
      return <svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>;
    case 'play':
      return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M7 4.5l13 7.5-13 7.5z" fill="currentColor" /></svg>;
    case 'pause':
      return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><rect x="6" y="4" width="4.5" height="16" rx="1" fill="currentColor" /><rect x="13.5" y="4" width="4.5" height="16" rx="1" fill="currentColor" /></svg>;
    case 'lock':
      return <svg {...p} width={16} height={16}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>;
    case 'bell':
      return <svg {...p}><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 004 0" /></svg>;
    case 'upload':
      return <svg {...p}><path d="M7 3h7l5 5v13H7z" /><path d="M12 17v-6M9.5 13.5L12 11l2.5 2.5" /></svg>;
    case 'paper':
      return <svg {...p}><path d="M3 6c3-1.5 6-1.5 9 1 3-2.5 6-2.5 9-1v13c-3-1.5-6-1.5-9 1-3-2.5-6-2.5-9-1z" /><path d="M12 7v13" /></svg>;
    case 'library':
      return <svg {...p}><path d="M5 5h4v15H5zM11 5h4v15h-4z" /><path d="M17 6l3 1-3 13-2.5-.6" /></svg>;
    default:
      return null;
  }
}

/** The SHRAVAN emblem (placeholder until the final logo). */
export function Emblem({ size = 140 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 168 168" aria-hidden fill="none">
      <circle cx="84" cy="84" r="80" stroke="var(--border)" strokeWidth="1.5" />
      <circle cx="84" cy="84" r="62" stroke="var(--accent)" strokeOpacity="0.55" strokeWidth="1.5" />
      <circle cx="84" cy="84" r="44" fill="var(--accent)" />
      <path d="M64 76c7-4 14-4 20 0v22c-6-4-13-4-20 0V76z" stroke="var(--accent-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M104 76c-7-4-14-4-20 0v22c6-4 13-4 20 0V76z" stroke="var(--accent-ink)" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function TopBar({ back, title, right }: { back?: string | true; title?: React.ReactNode; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="row between" style={{ minHeight: 44 }}>
      <div className="row" style={{ minWidth: 0 }}>
        {back && (
          typeof back === 'string' ? (
            <Link href={back} className="iconbtn" aria-label="Back">
              <Icon name="back" size={20} />
            </Link>
          ) : (
            <button className="iconbtn" aria-label="Back" onClick={() => router.back()}>
              <Icon name="back" size={20} />
            </button>
          )
        )}
        {title && <div className="muted" style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>}
      </div>
      {right}
    </div>
  );
}

export function BottomNav() {
  const path = usePathname();
  const { me } = useApp();
  const items = [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/mybooks', label: 'My books', icon: 'books' },
    { href: '/actions', label: 'My actions', icon: 'check' },
    { href: '/account', label: 'Account', icon: 'user' },
  ];
  return (
    <nav className="bottomnav" aria-label="Main">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={path === it.href ? 'on' : ''}>
          <Icon name={it.icon} />
          {it.label}
          {it.href === '/account' && !!me?.unread && <span className="dot" aria-label="New notices" />}
        </Link>
      ))}
    </nav>
  );
}

export function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="col" style={{ alignItems: 'center', padding: '40px 0' }} role="status">
      <div className="spinner" />
      <span className="muted small">{text}</span>
    </div>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="note bad" role="alert">
      {error}
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Steps({ step }: { step: 'listen' | 'reflect' | 'apply' }) {
  return (
    <div className="steps" aria-label="Lesson steps">
      {(['listen', 'reflect', 'apply'] as const).map((s) => (
        <span key={s} className={s === step ? 'on' : ''} aria-current={s === step ? 'step' : undefined}>
          {s === step ? s.toUpperCase() : s[0].toUpperCase() + s.slice(1)}
        </span>
      ))}
    </div>
  );
}
