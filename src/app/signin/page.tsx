'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/client';
import { Emblem, ErrorNote } from '@/components/ui';
import { useApp } from '@/components/AppProvider';

export default function SignIn() {
  const { session } = useApp();
  const router = useRouter();
  const [step, setStep] = useState<'choose' | 'email' | 'code'>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace('/');
  }, [session, router]);

  const google = async () => {
    setError(null);
    const { error } = await supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/' } });
    if (error) setError(`Google sign-in is not available right now. Please use email. (${error.message})`);
  };
  const sendCode = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      console.error('send code failed', error);
      setError(error.message.includes('rate') ? 'Please wait a minute before asking for another code.' : `Could not send the code. (${error.message || 'no reply from the sign-in service'})`);
    }
    else setStep('code');
  };
  const verify = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError('That code did not work. Check it, or ask for a new one.');
    else router.replace('/');
  };

  return (
    <main className="page nonav" style={{ justifyContent: 'space-between', paddingTop: 56 }}>
      <div className="col" style={{ alignItems: 'center', gap: 20, flex: 1, justifyContent: 'center' }}>
        <Emblem size={150} />
        <div className="col" style={{ alignItems: 'center', gap: 4 }}>
          <h1 style={{ fontSize: 40, letterSpacing: '0.28em', paddingLeft: '0.28em' }}>SHRAVAN</h1>
          <p style={{ margin: 0, color: 'var(--label)', fontWeight: 600, letterSpacing: '0.06em' }}>Listen. Reflect. Apply.</p>
          <p className="muted small" style={{ margin: '4px 0 0', letterSpacing: '0.14em', fontWeight: 600 }}>
            by AAYAMIK
          </p>
        </div>
        <p className="center" style={{ fontSize: 19, margin: 0, maxWidth: 300 }}>
          Great books, explained by a teacher who listens.
        </p>
        <p className="center muted" style={{ fontSize: 17, margin: 0 }}>
          किताबें सुनिए, समझिए और जीवन में अपनाइए।
        </p>
      </div>

      <div className="col">
        <ErrorNote error={error} />
        {step === 'choose' && (
          <>
            <button className="btn ghost" onClick={google}>
              Continue with Google
            </button>
            <button className="btn" onClick={() => setStep('email')}>
              Continue with email
            </button>
            <p className="center muted small" style={{ margin: 0 }}>
              We send a 6-digit code. No password to remember.
            </p>
          </>
        )}
        {step === 'email' && (
          <form
            className="col"
            onSubmit={(e) => {
              e.preventDefault();
              sendCode();
            }}
          >
            <label className="col" style={{ gap: 6 }}>
              <span className="small muted">Your email</span>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <button className="btn" disabled={busy || !email.includes('@')}>
              {busy ? 'Sending…' : 'Send me a code'}
            </button>
            <button type="button" className="linkbtn" onClick={() => setStep('choose')}>
              Back
            </button>
          </form>
        )}
        {step === 'code' && (
          <form
            className="col"
            onSubmit={(e) => {
              e.preventDefault();
              verify();
            }}
          >
            <p className="small" style={{ margin: 0 }}>
              We sent a 6-digit code to <b>{email}</b>.
            </p>
            <label className="col" style={{ gap: 6 }}>
              <span className="small muted">Code</span>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 24, letterSpacing: '0.4em', textAlign: 'center' }} />
            </label>
            <button className="btn" disabled={busy || code.length !== 6}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button type="button" className="linkbtn" onClick={sendCode}>
              Send a new code
            </button>
          </form>
        )}
        <p className="center muted tiny" style={{ margin: 0 }}>
          Free to start · English and हिन्दी
        </p>
      </div>
    </main>
  );
}
