'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Nav from '../components/Nav';
import Sidebar from '../components/Sidebar';
import CompanyCard from '../components/CompanyCard';
import ReviewCard from '../components/ReviewCard';
import RightRail from '../components/RightRail';
import { companies as fallbackCompanies, seedReviews } from '../lib/data';

export default function Home() {
  const [companies, setCompanies] = useState(fallbackCompanies);
  const [reviews, setReviews] = useState(seedReviews);
  useEffect(()=>{
    Promise.all([
      fetch('/api/companies?limit=8').then(r=>r.json()),
      fetch('/api/reviews?limit=10').then(r=>r.json())
    ]).then(([c,r])=>{
      if(c.companies?.length) setCompanies(c.companies);
      if(Array.isArray(r.reviews)) setReviews(r.reviews);
    }).catch(()=>{});
  },[]);
  return <>
    <Nav />
    <main className="shell">
      <Sidebar />
      <section className="feed">
        <Link href="/post" className="card composer composerLink"><div className="avatar reviewAvatar">◕</div><div className="composerBody"><div className="composerTop"><div><h2>Tell us what it’s really like</h2><span>Your experience can help someone else.</span></div><button>🔒 Post pseudonymously⌄</button></div><div className="chips big"><span>Micromanagement</span><span>Unpaid OT</span><span>Office Politics</span><span>Burnout</span><span>Low Pay</span><span>+</span></div></div></Link>
        {companies[0] && <CompanyCard company={companies[0]} />}
        {reviews.length ? reviews.map(r=><ReviewCard review={r} key={`${r.id}-${r.user}`} />) : <div className="card emptyState"><h3>No published stories yet.</h3><p>Be the first verified account to share workplace context.</p><Link className="button primary" href="/post">Write a review</Link></div>}
      </section>
      <RightRail initialCompanies={companies} />
    </main>
  </>;
}
