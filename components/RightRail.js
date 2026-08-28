'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { companies as fallbackCompanies } from '../lib/data';

export default function RightRail({initialCompanies}) {
  const [companies,setCompanies]=useState(initialCompanies?.length?initialCompanies:fallbackCompanies);
  const [scan, setScan] = useState('');
  const [scanResult, setScanResult] = useState('');
  const [phrase, setPhrase] = useState('');
  const [translation, setTranslation] = useState('');
  const [busy,setBusy]=useState('');

  useEffect(()=>{if(initialCompanies?.length)return;fetch('/api/companies?limit=8').then(r=>r.json()).then(d=>{if(d.companies?.length)setCompanies(d.companies)}).catch(()=>{})},[initialCompanies]);

  const doScan=async()=>{
    if(scan.trim().length<3)return;setBusy('scan');setScanResult('');
    try{const r=await fetch('/api/ai/tools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'redflag',text:scan})});const d=await r.json();setScanResult(`${d.risk ?? '—'}/100 risk — ${d.explanation||''}${d.findings?.length?` ${d.findings.join('; ')}.`:''}`)}catch{setScanResult('Could not scan right now.');}setBusy('');
  };
  const doTranslate=async()=>{
    if(phrase.trim().length<3)return;setBusy('translate');setTranslation('');
    try{const r=await fetch('/api/ai/tools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'translate',text:phrase})});const d=await r.json();setTranslation(d.translation||'No translation returned.')}catch{setTranslation('Could not translate right now.');}setBusy('');
  };

  const ranked=companies.filter(c=>c.reviews>0).slice(0,5);
  return <aside className="rightcol">
    <div className="card railCard"><div className="railTitle">🔥 Trending Companies <Link href="/companies">View all</Link></div>{(ranked.length?ranked:companies.slice(0,5)).map((c,i)=><Link href={`/company/${c.slug}`} className="trendRow" key={c.slug}><b>{i+1}</b><span className={`tinyLogo logo-${c.slug}`}>{c.logo}</span><span>{c.name}</span><strong>{c.reviews>0?Number(c.score||0).toFixed(1):'new'} <i>{c.trend>0?'↑':c.trend<0?'↓':''}</i></strong></Link>)}<small>Recognized pages + community review activity</small></div>
    <div className="card toolCard"><h3>🚩 AI Red Flag Scanner ⓘ</h3><p>Paste a job description. LinkedOut flags ambiguous workload and boundary language without assuming the employer is toxic.</p><textarea value={scan} onChange={e=>setScan(e.target.value)} placeholder='e.g. “Fast-paced environment seeking rockstars...”'></textarea><button onClick={doScan} disabled={busy==='scan'}>{busy==='scan'?'Scanning…':'◉ Scan Now'}</button>{scanResult&&<div className="toolResult">{scanResult}</div>}</div>
    <div className="card toolCard"><h3>Corporate Speak Translator ⓘ</h3><p>Decode vague corporate language cautiously.</p><input value={phrase} onChange={e=>setPhrase(e.target.value)} placeholder="Enter a phrase..."/><button className="outline" onClick={doTranslate} disabled={busy==='translate'}>{busy==='translate'?'Translating…':'↻ Translate'}</button>{translation&&<div className="toolResult">{translation}</div>}</div>
    <div className="card railCard"><div className="railTitle">Most Discussed <Link href="/companies">View all</Link></div>{companies.slice().sort((a,b)=>b.reviews-a.reviews).slice(0,5).map((c,i)=><Link href={`/company/${c.slug}`} className="trendRow" key={c.slug}><b>{i+1}</b><span className={`tinyLogo logo-${c.slug}`}>{c.logo}</span><span>{c.name}</span><em>{c.reviews?c.reviews.toLocaleString():'New'}</em></Link>)}</div>
  </aside>;
}
