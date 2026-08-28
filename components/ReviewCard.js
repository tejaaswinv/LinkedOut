'use client';
import { authFetch } from '../lib/authFetch';
import { useState } from 'react';
import Link from 'next/link';

export default function ReviewCard({ review }) {
  const [votes, setVotes] = useState(review.votes || 0);
  const [userVote,setUserVote]=useState(0);
  const [notice,setNotice]=useState('');
  const vote=async(value)=>{
    const next=userVote===value?0:value;
    try{
      const r=await authFetch(`/api/reviews/${review.id}/vote`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:next})});
      const d=await r.json();
      if(!r.ok){setNotice(r.status===401?'Sign in to vote.':d.error||'Could not vote.');return;}
      setVotes(d.score);setUserVote(d.userVote);setNotice('');
    }catch{
      const delta=next-userVote;setVotes(v=>v+delta);setUserVote(next);
    }
  };
  return <article className="card reviewCard">
    <div className="reviewTop">
      <div className="avatar reviewAvatar">◕</div>
      <div><div><b>{review.user}</b> {review.verified && <span className="verifiedBadge">Verified Employee</span>}</div><small>{review.role}{review.department?` · ${review.department}`:''} &nbsp;•&nbsp; {review.tenure} at <Link href={`/company/${review.companySlug}`}>{review.company}</Link>{review.location?` · ${review.location}`:''}</small></div>
      <span className="reviewTime">{review.time} ago &nbsp;•••</span>
    </div>
    <p>{review.body}</p>
    <div className="chips">{review.tags?.map(t=><span key={t}>{t}</span>)}</div>
    <div className="reviewActions"><button onClick={()=>vote(1)} className={userVote===1?'voted':''}>⇧ {votes}</button><button onClick={()=>vote(-1)} className={userVote===-1?'voted down':''}>⇩</button><button>◯ {review.comments || 0}</button><button onClick={()=>navigator.share?.({title:'LinkedOut workplace story',url:window.location.href}).catch(()=>{})}>↗ Share</button><button className="save">▱</button></div>{notice&&<div className="miniNotice">{notice}</div>}
  </article>
}
