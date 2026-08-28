'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import Nav from '../components/Nav';
import Sidebar from '../components/Sidebar';
import CompanyCard from '../components/CompanyCard';
import ReviewCard from '../components/ReviewCard';
import RightRail from '../components/RightRail';
import LandingPage from '../components/LandingPage';
import Logo from '../components/Logo';
import { getFirebaseAuth } from '../lib/firebase/client';

export default function Home() {
  const [user, setUser] = useState(undefined);
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
    if (!user) return;
    setContentLoaded(false);
    Promise.all([
      fetch('/api/companies?limit=8').then((r) => r.json()),
      fetch('/api/reviews?limit=10').then((r) => r.json())
    ]).then(([companyData, reviewData]) => {
      setCompanies(Array.isArray(companyData.companies) ? companyData.companies : []);
      setReviews(Array.isArray(reviewData.reviews) ? reviewData.reviews : []);
    }).catch(() => {
      setCompanies([]);
      setReviews([]);
    }).finally(() => setContentLoaded(true));
  }, [user]);

  if (user === undefined) {
    return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#f7faff'}}><div style={{textAlign:'center'}}><Logo/><p style={{color:'#667085',marginTop:16}}>Checking your LinkedOut session…</p></div></main>;
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
