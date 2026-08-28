'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '../../components/Nav';
import { authFetch } from '../../lib/authFetch';

const tags=['Micromanagement','Unpaid OT','Office Politics','Burnout','Low Pay','Poor Management','Promotion Politics','Layoff Anxiety','Nepotism','High Turnover','Great Learning','Good Manager'];
const ratingLabels=[['workLifeBalance','Work-Life Balance'],['management','Management'],['officePolitics','Office Politics'],['compensation','Compensation']];

export default function Post(){
  const router=useRouter();
  const [companies,setCompanies]=useState([]);
  const [form,setForm]=useState({company:'',role:'Deputy Manager',department:'',employmentStatus:'current',tenure:'2 years',location:'Singapore',body:'',tags:[],ratings:{workLifeBalance:3,management:3,officePolitics:3,compensation:3}});
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{Promise.all([fetch('/api/companies?limit=100').then(r=>r.json()),authFetch('/api/profile').then(r=>r.json())]).then(([c,p])=>{
    setCompanies(c.companies||[]);
    const first=c.companies?.[0]?.slug||'';
    if(p.error && /sign in/i.test(p.error)){router.replace('/login');return;}
    const prof=p.profile||{};
    const verified=p.verifications?.find(v=>v.status==='verified'&&v.employment_status==='current');
    setForm(f=>({...f,company:verified?.company?.slug||first,role:verified?.role_title||prof.position||f.role,department:verified?.department||prof.department||'',location:verified?.location||prof.location||f.location,employmentStatus:verified?.employment_status||'current'}));
  }).catch(()=>{});},[]);

  const toggle=t=>setForm(f=>({...f,tags:f.tags.includes(t)?f.tags.filter(x=>x!==t):f.tags.length<8?[...f.tags,t]:f.tags}));
  const specificity=useMemo(()=>{
    let s=0;
    if(form.role.length>28||/chief|head of|global|regional/i.test(form.role))s++;
    if(form.department.length>24)s++;
    if(form.location.split(',').length>1||form.location.length>24)s++;
    return s;
  },[form.role,form.department,form.location]);

  const submit=async e=>{e.preventDefault();setBusy(true);setMessage('');const r=await authFetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const d=await r.json();if(!r.ok){setMessage(d.error||'Could not submit review.');setBusy(false);return;}setMessage(d.message);setBusy(false);setTimeout(()=>router.push('/reviews'),700);};

  return <><Nav/><main className="pageWrap formWrap"><form className="card reviewForm" onSubmit={submit}><h1>Tell us what it’s really like</h1><p>Your professional context can be public. Your personal particulars stay private. Posts are automatically screened for doxxing and unsafe personal information.</p>
    <label>Company<select value={form.company} onChange={e=>setForm({...form,company:e.target.value})} required>{companies.map(c=><option value={c.slug} key={c.slug}>{c.name}</option>)}</select></label>
    <div className="formRow"><label>Position<input value={form.role} onChange={e=>setForm({...form,role:e.target.value})} required/></label><label>Department<input value={form.department} onChange={e=>setForm({...form,department:e.target.value})} placeholder="Optional"/></label></div>
    <div className="formRow"><label>Location<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} required/></label><label>Employment status<select value={form.employmentStatus} onChange={e=>setForm({...form,employmentStatus:e.target.value})}><option value="current">Current employee</option><option value="former">Former employee</option></select></label></div>
    <label>Tenure shown publicly<input value={form.tenure} onChange={e=>setForm({...form,tenure:e.target.value})} placeholder="e.g. 2 years"/></label>
    {specificity>1&&<div className="anonymityWarning">⚠ This title + department + location combination may make you easier to identify. You can still post it, but consider broadening one field.</div>}
    <div className="ratingGrid">{ratingLabels.map(([k,label])=><label key={k}>{label}<select value={form.ratings[k]} onChange={e=>setForm({...form,ratings:{...form.ratings,[k]:Number(e.target.value)}})}>{[1,2,3,4,5].map(n=><option value={n} key={n}>{n} / 5</option>)}</select></label>)}</div>
    <label>Your experience<textarea required rows="8" minLength="30" maxLength="6000" value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Describe workload, management, growth, culture, pay, layoffs or what you wish you knew before joining. Don't include coworkers' names, phone numbers or personal contact details."/></label>
    <fieldset><legend>Tags — choose up to 8</legend><div className="chips big selectable">{tags.map(t=><button type="button" onClick={()=>toggle(t)} className={form.tags.includes(t)?'selected':''} key={t}>{t}</button>)}</div></fieldset>
    <label className="consent"><input type="checkbox" required/> I understand LinkedOut displays the professional context I choose to share, while keeping my account details and verification evidence private.</label>
    {message&&<div className="authMessage">{message}</div>}
    <button className="button primary submit" type="submit" disabled={busy||!form.company}>{busy?'Moderating & submitting…':'Post pseudonymously'}</button><Link className="verifyHint" href="/verify">Want a Verified Employee badge? Verify your workplace first →</Link>
  </form></main></>}
