'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';
import ReviewCard from '../../components/ReviewCard';
import { seedReviews } from '../../lib/data';

export default function Reviews(){
  const [items,setItems]=useState(seedReviews);
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{fetch('/api/reviews?limit=30').then(r=>r.json()).then(d=>{if(Array.isArray(d.reviews))setItems(d.reviews);setLoaded(true)}).catch(()=>setLoaded(true))},[])
  return <><Nav/><main className="pageWrap narrow"><div className="sectionTitle"><div><h1>Latest workplace stories</h1><p>Verified accounts. Pseudonymous identities. Professional context.</p></div><Link className="button primary inlineButton" href="/post">Write review</Link></div>{items.length?items.map(r=><ReviewCard review={r} key={`${r.id}-${r.user}`}/>):loaded?<div className="card emptyState"><h3>No published stories yet.</h3><p>Submitted reviews may also be waiting for moderation.</p></div>:null}</main></>
}
