'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import Nav from '../components/Nav';
import Sidebar from '../components/Sidebar';
import CompanyCard from '../components/CompanyCard';
import ReviewCard from '../components/ReviewCard';
import RightRail from '../components/RightRail';
import LandingPage from '../components/LandingPage';
import Logo from '../components/Logo';
import { authFetch } from '../lib/authFetch';
import { getFirebaseAuth } from '../lib/firebase/client';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(undefined);
  const [profileReady, setProfileReady] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [contentLoaded, setContentLoaded] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setUser(null);
      return;
    }
    return onAuthStateChanged(auth, (next) => setUser(next || null), () => setUser(null));
  }, []);

  useEffect(() => {
    if (!user) {
      setProfileReady(false);
      return;
    }
    let active = true;
    setContentLoaded(false);
    setProfileReady(false);
    authFetch('/api/profile')
      .then(async (response) => ({ status:response.status, ok:response.ok, data:await response.json() }))
      .then(async ({ status, ok, data }) => {
        if (!active) return;
        if (status === 401) {
          setUser(null);
          return;
        }
        if (!ok) throw new Error(data.error || 'Could not load profile.');
        if (!data.profile?.onboardingComplete) {
          router.replace('/onboarding');
          return;
        }
        setProfileReady(true);
        const [companyData, reviewData] = await Promise.all([
          fetch('/api/companies?limit=8').then((r) => r.json()),
          fetch('/api/reviews?limit=10').then((r) => r.json())
        ]);
        if (!active) return;
        setCompanies(Array.isArray(companyData.companies) ? companyData.companies : []);
        setReviews(Array.isArray(reviewData.reviews) ? reviewData.reviews : []);
        setContentLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setCompanies([]);
        setReviews([]);
        setProfileReady(true);
        setContentLoaded(true);
      });
    return () => { active = false; };
  }, [user, router]);

  if (user === undefined || (user && !profileReady)) {
    return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#f7faff'}}><div style={{textAlign:'center'}}><Logo/><p style={{color:'#667085',marginTop:16}}>{user === undefined ? 'Checking your LinkedOut session…' : 'Preparing your pseudonymous profile…'}</p></div></main>;
  }

  if (!user) return <LandingPage />;

  return <>
    <Nav />
    <main className="shell">
      <Sidebar />
      <section className="feed">
        <Link href="/post" className="card composer composerLink"><div className="avatar reviewAvatar">◕</div><div className="composerBody"><div className="composerTop"><div><h2>Tell us what it’s really like</h2><span>Your experience can help someone else.</span></div><button>🔒 Post pseudonymously⌄</button></div><div className="chips big"><span>Micromanagement</span><span>Unpaid OT</span><span>Office Politics</span><span>Burnout</span><span>Low Pay</span><span>+</span></div></div></Link>
        {companies[0] && <CompanyCard company={companies[0]} />}
        {!contentLoaded ? <div className="card emptyState"><h3>Loading workplace stories…</h3><p>Fetching published community reviews.</p></div> : reviews.length ? reviews.map((r) => <ReviewCard review={r} key={`${r.id}-${r.user}`} />) : <div className="card emptyState"><h3>No published stories yet.</h3><p>Be the first verified account to share workplace context.</p><Link className="button primary" href="/post">Write a review</Link></div>}
      </section>
      <RightRail initialCompanies={companies} />
    </main>
  </>;
}
