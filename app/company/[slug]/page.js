'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Nav from '../../../components/Nav';
import CompanyCard from '../../../components/CompanyCard';
import ReviewCard from '../../../components/ReviewCard';

export default function CompanyPage(){
  const {slug}=useParams();
  const [company,setCompany]=useState(null);
  const [reviews,setReviews]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{if(!slug)return;Promise.all([fetch(`/api/companies?slug=${encodeURIComponent(slug)}`).then(r=>r.json()),fetch(`/api/reviews?company=${encodeURIComponent(slug)}&limit=40`).then(r=>r.json())]).then(([c,r])=>{setCompany(c.companies?.[0]||null);setReviews(r.reviews||[]);setLoading(false)}).catch(()=>setLoading(false))},[slug]);
  return <><Nav/><main className="companyPage"><section>{loading?<div className="card emptyState">Loading company page…</div>:company?<><CompanyCard company={company}/><div className="sectionTitle"><h2>Employee experiences</h2><span>{reviews.length ? `${reviews.length} recent published stories` : 'No published reviews yet'}</span></div>{reviews.length?reviews.map(r=><ReviewCard key={r.id} review={r}/>):<div className="card emptyState"><h3>No published stories yet.</h3><p>Be the first person to share context about working here.</p><Link className="button primary" href="/post">Write a review</Link></div>}</>:<div className="card emptyState"><h3>Company page not found.</h3><Link href="/companies">Browse recognized companies</Link></div>}</section><aside className="companyAside card"><h3>Independent company page</h3><p>Companies do not need to sign up or control this page. LinkedOut maintains recognized company records and summarizes community reviews.</p><hr/><h3>Review integrity</h3><p>Posts may show employer, title, department and location. Personal contact data, account details and verification evidence remain private.</p><hr/><h3>Employment verification</h3><p>Employees can privately verify via a recognized work-email domain or submit limited employment proof.</p><Link className="button secondary" href="/verify">Verify employment</Link><Link className="button primary" href="/post">Write a review</Link></aside></main></>;
}
