'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Nav from '../../../components/Nav';
import CompanyCard from '../../../components/CompanyCard';
import ReviewCard from '../../../components/ReviewCard';

function formatMoney(value){
  const n=Number(value||0); if(!n)return null;
  if(n>=1e12)return `$${(n/1e12).toFixed(1)}T`;
  if(n>=1e9)return `$${(n/1e9).toFixed(1)}B`;
  if(n>=1e6)return `$${(n/1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

export default function CompanyPage(){
  const {slug}=useParams();
  const [company,setCompany]=useState(null);
  const [reviews,setReviews]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{if(!slug)return;Promise.all([fetch(`/api/companies?slug=${encodeURIComponent(slug)}`).then(r=>r.json()),fetch(`/api/reviews?company=${encodeURIComponent(slug)}&limit=40`).then(r=>r.json())]).then(([c,r])=>{setCompany(c.companies?.[0]||null);setReviews(r.reviews||[]);setLoading(false)}).catch(()=>setLoading(false))},[slug]);
  const revenue=formatMoney(company?.revenueUsd);
  return <><Nav/><main className="companyPage"><section>{loading?<div className="card emptyState">Loading company page…</div>:company?<><CompanyCard company={company}/>
    {(company.description||company.foundedYear||company.employeeCount||revenue||company.website) && <div className="card entityInfoCard companyProfileDetails"><h2>Company profile</h2>{company.description&&<p>{company.description}</p>}<div className="entityFacts entityFactsLarge">{company.foundedYear&&<div><small>Founded</small><b>{company.foundedYear}</b></div>}{company.employeeCount>0&&<div><small>Employees</small><b>{company.employeeCount.toLocaleString()}</b></div>}{revenue&&<div><small>Revenue</small><b>{revenue}</b></div>}{company.ticker&&<div><small>Public listing</small><b>{company.exchange?`${company.exchange}: `:''}{company.ticker}</b></div>}</div>{company.website&&<a className="entityOpenLink" href={/^https?:\/\//.test(company.website)?company.website:`https://${company.website}`} target="_blank" rel="noreferrer">Official website ↗</a>}{company.wikipediaUrl&&<a className="entityOpenLink" href={company.wikipediaUrl} target="_blank" rel="noreferrer">Wikipedia ↗</a>}</div>}
    <div className="sectionTitle"><h2>Employee experiences</h2><span>{reviews.length ? `${reviews.length} recent published stories` : 'No published reviews yet'}</span></div>{reviews.length?reviews.map(r=><ReviewCard key={r.id} review={r}/>):<div className="card emptyState"><h3>No published stories yet.</h3><p>Be the first person to share context about working here.</p><Link className="button primary" href="/post">Write a review</Link></div>}</>:<div className="card emptyState"><h3>Company page not found.</h3><Link href="/companies">Browse recognized companies</Link></div>}</section><aside className="companyAside card"><h3>Independent company page</h3><p>Companies do not need to sign up or control this page. LinkedOut maintains recognized company records and summarizes community reviews.</p><hr/><h3>Review integrity</h3><p>Posts may show employer, title, department and location. Personal contact data, account details and verification evidence remain private.</p><hr/><h3>Employment verification</h3><p>Employees can privately verify via a recognized work-email domain or submit limited employment proof.</p>{company?.rankingSourceUrl&&<><hr/><h3>External ranking source</h3><a href={company.rankingSourceUrl} target="_blank" rel="noreferrer">View source ↗</a></>}<Link className="button secondary" href="/verify">Verify employment</Link><Link className="button primary" href="/post">Write a review</Link></aside></main></>;
}
