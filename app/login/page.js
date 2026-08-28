'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import Logo from '../../components/Logo';
import { authFetch } from '../../lib/authFetch';
import { getFirebaseAuth, getGoogleProvider, isFirebaseConfigured } from '../../lib/firebase/client';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ email: '', password: '', username: '@' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) setMessage(params.get('error'));
    if (params.get('mode') === 'signup') setMode('signup');
  }, []);

  const ensureUsername = async (username) => {
    const response = await authFetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not create your LinkedOut profile.');
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const auth = getFirebaseAuth();
    if (!auth || !isFirebaseConfigured()) {
      setMessage('Firebase is not configured yet. Add the NEXT_PUBLIC_FIREBASE_* variables from .env.example.');
      setBusy(false);
      return;
    }

    try {
      if (mode === 'signup') {
        if (!/^@[A-Za-z0-9_]{3,24}$/.test(form.username)) {
          throw new Error('Use an @username with 3-24 letters, numbers or underscores.');
        }
        const credential = await createUserWithEmailAndPassword(auth, form.email, form.password);
        await updateProfile(credential.user, { displayName: form.username });
        await credential.user.getIdToken(true);
        try {
          await ensureUsername(form.username);
        } catch (error) {
          await credential.user.delete().catch(() => {});
          throw error;
        }
        await sendEmailVerification(credential.user, { url: `${window.location.origin}/onboarding` });
        setMessage('Account created. We sent a verification link to your private email.');
        setTimeout(() => router.push('/onboarding'), 600);
      } else {
        await signInWithEmailAndPassword(auth, form.email, form.password);
        router.push('/');
      }
    } catch (error) {
      const friendly = String(error?.message || error)
        .replace(/^Firebase:\s*/i, '')
        .replace(/\s*\(auth\/[a-z-]+\)\.?$/i, '');
      setMessage(friendly);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true); setMessage('');
    const auth = getFirebaseAuth();
    if (!auth) { setMessage('Firebase is not configured yet.'); setBusy(false); return; }
    try {
      await signInWithPopup(auth, getGoogleProvider());
      // First API call creates the private LinkedOut identity and a random public pseudonym.
      await authFetch('/api/profile');
      router.push('/onboarding');
    } catch (error) {
      setMessage(String(error?.message || error).replace(/^Firebase:\s*/i, ''));
    } finally {
      setBusy(false);
    }
  };

  return <main className="authShell">
    <section className="authBrand">
      <Link href="/"><Logo /></Link>
      <h1>Anonymous to the public.<br/>Verified to LinkedOut.</h1>
      <p>Share what work is really like without publishing your name, phone number, personal email or verification evidence.</p>
      <div className="authTrust"><span>✓ Firebase account verification</span><span>✓ Optional employment verification</span><span>✓ Moderated workplace stories</span></div>
    </section>
    <form className="card authCard" onSubmit={submit}>
      <h2>{mode === 'signin' ? 'Sign in' : 'Create your pseudonymous account'}</h2>
      <p>{mode === 'signin' ? 'Welcome back to LinkedOut.' : 'Your login email stays private. Your username is public.'}</p>
      {mode === 'signup' && <label>Public username<input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="@quarterly_crisis" required/></label>}
      <label>Private email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label>
      <label>Password<input type="password" minLength="8" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></label>
      {message && <div className="authMessage">{message}</div>}
      <button className="button primary authButton" disabled={busy}>{busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      <div className="authDivider"><span>or</span></div>
      <button className="button secondary authButton" type="button" onClick={google} disabled={busy}>Continue with Google</button>
      <button className="authSwitch" type="button" onClick={()=>{setMode(mode==='signin'?'signup':'signin');setMessage('')}}>{mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button>
    </form>
  </main>;
}
