'use client';
import { useEffect, useState } from 'react';
import Nav from '../../components/Nav';
import CompanyCard from '../../components/CompanyCard';

export default function Companies(){
  const [q,setQ]=useState('');
  const [companies,setCompanies]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const initial=params.get('q')||'';
    if(initial&&!q)setQ(initial);
  },[]);
  useEffect(()=>{
    const timer=setTimeout(async()=>{
      setLoading(true);setError('');
      try{
        const r=await fetch(`/api/companies?limit=60&q=${encodeURIComponent(q.trim())}`);
        const d=await r.json();
        if(!r.ok)throw new Error(d.error||'Could not load companies.');
        setCompanies(Array.isArray(d.companies)?d.companies:[]);
      }catch(err){setCompanies([]);setError(err.message||'Could not load companies.');}
      finally{setLoading(false);}
    },q.trim()?220:0);
    return()=>clearTimeout(timer);
  },[q]);
  return <><Nav/><main className="pageWrap"><div className="pageHero catalogHero"><div><span className="eyebrow">Employer directory</span><h1>Company pages</h1><p>Recognized employer pages exist whether or not the company participates.</p></div><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search companies, industries, domains or locations"/></div><div className="directoryMeta"><b>{companies.length}</b> results <span>· Community ratings appear only after published reviews.</span></div>{error&&<div className="card emptyState">{error}</div>}{loading&&!companies.length?<div className="card emptyState">Loading company directory…</div>:<div className="companyGrid">{companies.map(c=><CompanyCard key={c.slug} company={c} large={false}/>)}</div>}</main></>;
}
