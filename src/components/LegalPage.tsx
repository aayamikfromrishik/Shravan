// Shared layout for the Privacy and Terms pages (readable without signing in).
import Link from 'next/link';

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="page" style={{ maxWidth: 720 }}>
      <div className="row between">
        <Link href="/" className="wordmark" style={{ textDecoration: 'none' }}>
          SHRAVAN
        </Link>
        <span className="tiny muted">by AAYAMIK</span>
      </div>
      <h1 style={{ fontSize: 28, marginBottom: 0 }}>{title}</h1>
      <span className="tiny muted">Last updated {updated}</span>
      <div className="col legal" style={{ gap: 12, lineHeight: 1.6 }}>
        {children}
      </div>
      <p className="tiny muted">
        <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
      </p>
    </main>
  );
}
