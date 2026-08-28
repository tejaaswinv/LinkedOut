'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import Logo from './Logo';
import styles from './LandingPage.module.css';
import { getFirebaseAuth, getGoogleProvider, isFirebaseConfigured } from '../lib/firebase/client';
import { authFetch } from '../lib/authFetch';

export default function LandingPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const continueWithGoogle = async () => {
    setBusy(true);
    setMessage('');
    const auth = getFirebaseAuth();

    if (!auth || !isFirebaseConfigured()) {
      setMessage('Firebase is not configured yet. Check your NEXT_PUBLIC_FIREBASE_* variables.');
      setBusy(false);
      return;
    }

    try {
      await signInWithPopup(auth, getGoogleProvider());
      await authFetch('/api/profile');
      router.replace('/');
      router.refresh();
    } catch (error) {
      setMessage(String(error?.message || error).replace(/^Firebase:\s*/i, ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}><Logo /></Link>
        <div className={styles.headerActions}>
          <Link href="/login" className={styles.signIn}>Sign in</Link>
          <Link href="/login?mode=signup" className={styles.join}>Join LinkedOut</Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.copy}>
          <div className={styles.eyebrow}>Workplace truth, without career risk</div>
          <h1>Your company has a LinkedIn page.<br/><span>Now it has a LinkedOut page.</span></h1>
          <p className={styles.lead}>Share what work is really like through a pseudonymous profile. Your public professional context can help others while your real identity and verification evidence stay private.</p>

          <div className={styles.ctas}>
            <button onClick={continueWithGoogle} disabled={busy} className={styles.googleButton}>
              <span className={styles.googleMark}>G</span>
              {busy ? 'Signing in…' : 'Continue with Google'}
            </button>
            <Link href="/login?mode=signup" className={styles.emailButton}>Sign up with email</Link>
          </div>
          <Link href="/login" className={styles.existing}>Already have an account? <b>Sign in</b></Link>
          {message && <div className={styles.message}>{message}</div>}

          <div className={styles.trustRow}>
            <span>✓ Real accounts</span>
            <span>✓ Pseudonymous publicly</span>
            <span>✓ Employment verification optional</span>
          </div>
        </div>

        <div className={styles.visualWrap} aria-label="LinkedOut privacy model preview">
          <div className={styles.visualGlow}></div>
          <div className={styles.previewCard}>
            <div className={styles.previewTop}>
              <div className={styles.previewAvatar}>◕</div>
              <div>
                <strong>@quarterly_crisis</strong>
                <span>Verified account</span>
              </div>
              <div className={styles.lock}>🔒</div>
            </div>
            <div className={styles.contextGrid}>
              <div><small>PUBLIC</small><b>Employer</b><span>Optional</span></div>
              <div><small>PUBLIC</small><b>Role</b><span>Optional</span></div>
              <div><small>PUBLIC</small><b>Location</b><span>Optional</span></div>
            </div>
            <div className={styles.privateBox}>
              <div className={styles.privateTitle}><span>◆</span><b>Private by design</b></div>
              <div className={styles.privateRows}>
                <span>Real name <b>Hidden</b></span>
                <span>Login email <b>Hidden</b></span>
                <span>Phone number <b>Hidden</b></span>
                <span>Verification evidence <b>Hidden</b></span>
              </div>
            </div>
            <div className={styles.previewFooter}>Anonymous to the public. Verified to LinkedOut.</div>
          </div>
        </div>
      </section>

      <section className={styles.features}>
        <article>
          <div className={styles.featureIcon}>◫</div>
          <h2>Honest workplace stories</h2>
          <p>Read professional context from people who actually worked there, without turning the platform into a popularity contest.</p>
        </article>
        <article>
          <div className={styles.featureIcon}>✓</div>
          <h2>Private verification</h2>
          <p>Account and employment verification happen privately. Public profiles stay pseudonymous.</p>
        </article>
        <article>
          <div className={styles.featureIcon}>✦</div>
          <h2>Company intelligence</h2>
          <p>Recognized company pages aggregate recurring themes, ratings and workplace signals from moderated reviews.</p>
        </article>
      </section>

      <section className={styles.bottomCta}>
        <div>
          <small>LINKEDOUT</small>
          <h2>Disconnect from corporate theatre.<br/>Reconnect with what work is actually like.</h2>
        </div>
        <Link href="/login?mode=signup">Create your pseudonym →</Link>
      </section>
    </main>
  );
}
