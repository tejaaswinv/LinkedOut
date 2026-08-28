'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Nav from '../../components/Nav';
import { authFetch } from '../../lib/authFetch';

export default function VerifyPage() {
  const [companies, setCompanies] = useState([]);
  const [method, setMethod] = useState('email');
  const [form, setForm] = useState({ company:'', workEmail:'', role:'Deputy Manager', department:'', location:'Singapore', employmentStatus:'current' });
  const [verificationId, setVerificationId] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(()=>{
    fetch('/api/companies?limit=100').then(r=>r.json()).then(d=>{
      setCompanies(d.companies || []);
      if (d.companies?.length) setForm(f=>({...f, company:f.company || d.companies[0].slug}));
    }).catch(()=>{});
  },[]);

  const selected = useMemo(()=>companies.find(c=>c.slug===form.company),[companies,form.company]);

  const startEmail = async (e) => {
    e.preventDefault(); setBusy(true); setMessage('');
    const response = await authFetch('/api/verification/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
    const data = await response.json();
    if (!response.ok) setMessage(data.error || 'Could not start verification.');
    else { setVerificationId(data.verificationId); setDevCode(data.devCode || ''); setMessage(`Code sent to your ${selected?.name || 'company'} work email.`); }
    setBusy(false);
  };

  const confirm = async (e) => {
    e.preventDefault(); setBusy(true); setMessage('');
    const response = await authFetch('/api/verification/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({verificationId,code})});
    const data = await response.json();
    if (!response.ok) setMessage(data.error || 'Verification failed.');
    else setMessage('✓ Employment verified. Your public posts can now carry the Verified Employee badge.');
    setBusy(false);
  };

  const upload = async (e) => {
    e.preventDefault(); setBusy(true); setMessage('');
    const fd = new FormData(e.currentTarget);
    const response = await authFetch('/api/verification/document',{method:'POST',body:fd});
    const data = await response.json();
    setMessage(response.ok ? data.message : data.error || 'Upload failed.');
    setBusy(false);
  };

  return <><Nav/><main className="pageWrap verifyWrap">
    <div className="pageHero verifyHero"><h1>Verify your workplace</h1><p>LinkedOut verifies the employment relationship privately. Your work email or proof is never shown publicly.</p></div>
    <div className="methodTabs"><button className={method==='email'?'active':''} onClick={()=>setMethod('email')}>Work email</button><button className={method==='document'?'active':''} onClick={()=>setMethod('document')}>Employment document</button></div>

    {method==='email' && !verificationId && <form className="card reviewForm" onSubmit={startEmail}>
      <h2>Fast verification</h2><p>We send a one-time code to a recognized company-domain email. We store a hash of the email, not the address itself.</p>
      <label>Company<select value={form.company} onChange={e=>setForm({...form,company:e.target.value})}>{companies.map(c=><option value={c.slug} key={c.slug}>{c.name}</option>)}</select></label>
      <label>Work email<input type="email" value={form.workEmail} onChange={e=>setForm({...form,workEmail:e.target.value})} placeholder={selected?.domain ? `you@${selected.domain}` : 'you@company.com'} required/></label>
      <div className="formRow"><label>Position<input value={form.role} onChange={e=>setForm({...form,role:e.target.value})} required/></label><label>Department<input value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></label></div>
      <div className="formRow"><label>Location<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><label>Status<select value={form.employmentStatus} onChange={e=>setForm({...form,employmentStatus:e.target.value})}><option value="current">Current employee</option><option value="former">Former employee</option></select></label></div>
      {message && <div className="authMessage">{message}</div>}
      <button className="button primary submit" disabled={busy}>{busy?'Sending…':'Send verification code'}</button>
    </form>}

    {method==='email' && verificationId && <form className="card reviewForm" onSubmit={confirm}>
      <h2>Enter your code</h2><p>The code expires after 10 minutes.</p>
      {devCode && <div className="devCode">Local-dev code: <b>{devCode}</b></div>}
      <label>6-digit code<input inputMode="numeric" maxLength="6" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} placeholder="000000" required/></label>
      {message && <div className="authMessage">{message}</div>}
      <button className="button primary submit" disabled={busy || code.length!==6}>{busy?'Checking…':'Verify employment'}</button>
      <button className="authSwitch" type="button" onClick={()=>{setVerificationId('');setCode('');setMessage('')}}>Start over</button>
    </form>}

    {method==='document' && <form className="card reviewForm" onSubmit={upload}>
      <h2>Private proof review</h2><p>Useful for former employees or companies where work email access is unavailable. Upload only the minimum evidence needed. Files live in a private Supabase bucket and are never exposed publicly.</p>
      <label>Company<select name="company" value={form.company} onChange={e=>setForm({...form,company:e.target.value})}>{companies.map(c=><option value={c.slug} key={c.slug}>{c.name}</option>)}</select></label>
      <div className="formRow"><label>Position<input name="role" value={form.role} onChange={e=>setForm({...form,role:e.target.value})} required/></label><label>Department<input name="department" value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></label></div>
      <div className="formRow"><label>Location<input name="location" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><label>Status<select name="employmentStatus" value={form.employmentStatus} onChange={e=>setForm({...form,employmentStatus:e.target.value})}><option value="current">Current employee</option><option value="former">Former employee</option></select></label></div>
      <label>Employment proof<input name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required/><small className="fieldHelp">Offer/experience letter, payslip with unnecessary fields redacted, or another employment document. Max 8 MB.</small></label>
      {message && <div className="authMessage">{message}</div>}
      <button className="button primary submit" disabled={busy}>{busy?'Uploading…':'Submit privately for verification'}</button>
    </form>}
    <div className="verifyFoot"><Link href="/profile">← Back to profile</Link></div>
  </main></>;
}
