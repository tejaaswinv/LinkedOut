'use client';
import { useEffect, useMemo, useState } from 'react';
import Nav from '../../components/Nav';
import CompanyCard from '../../components/CompanyCard';

export default function Companies(){
  const [q,setQ]=useState('');
  const [companies,setCompanies]=useState([]);
  useEffect(()=>{const params=new URLSearchParams(window.location.search);if(params.get('q'))setQ(params.get('q'));fetch('/api/companies?limit=100').then(r=>r.json()).then(d=>{setCompanies(Array.isArray(d.companies)?d.companies:[])}).catch(()=>{})},[]);
  const shown=useMemo(()=>companies.filter(c=>`${c.name} ${c.sector} ${c.location} ${c.domain||''}`.toLowerCase().includes(q.toLowerCase())),[q,companies]);
  return <><Nav/><main className="pageWrap"><div className="pageHero"><h1>Company directory</h1><p>Recognized employer pages exist whether or not the company participates.</p><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search companies, industries, domains or locations"/></div><div className="directoryMeta"><b>{shown.length}</b> recognized company pages <span>· Community ratings appear only after published reviews.</span></div><div className="companyGrid">{shown.map(c=><CompanyCard key={c.slug} company={c} large={false}/>)}</div></main></>;
}
