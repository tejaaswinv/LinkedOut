'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Nav from '../../components/Nav';
import { authFetch } from '../../lib/authFetch';

function isVerificationValid(verification) {
  if (!verification || verification.status !== 'verified') return false;
  if (!verification.verified_until) return true;
  return new Date(verification.verified_until).getTime() > Date.now();
}

function humanDate(value) {
  if (!value) return '';
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)); }
  catch { return ''; }
}

export default function VerifyPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [method, setMethod] = useState('email');
  const [form, setForm] = useState({ company:'', workEmail:'', role:'', department:'', location:'', employmentStatus:'current' });
  const [verificationId, setVerificationId] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fromOnboarding, setFromOnboarding] = useState(false);

  const load = async () => {
    const [profileResponse, companyResponse] = await Promise.all([
      authFetch('/api/profile'),
      fetch('/api/companies?limit=100')
    ]);
    const [profileData, companyData] = await Promise.all([profileResponse.json(), companyResponse.json()]);
    if (profileResponse.status === 401) {
      router.replace('/login');
      return;
    }
    if (!profileResponse.ok) throw new Error(profileData.error || 'Could not load verification details.');
    const profile = profileData.profile || {};
    if (!profile.onboardingComplete) {
      router.replace('/onboarding');
      return;
    }
    const list = Array.isArray(companyData.companies) ? companyData.companies : [];
    setCompanies(list);
    setVerifications(profileData.verifications || []);
    const params = new URLSearchParams(window.location.search);
    const requestedCompany = params.get('company');
    setFromOnboarding(params.get('from') === 'onboarding');
    const companySlug = requestedCompany || profile.currentCompany?.slug || list[0]?.slug || '';
    const profileStatus = ['current','former'].includes(profile.employment_status) ? profile.employment_status : 'current';
    setForm((current) => ({
      ...current,
      company: companySlug,
      role: profile.position || current.role,
      department: profile.department || '',
      location: profile.location || '',
      employmentStatus: profileStatus
    }));
    if (profileStatus === 'former') setMethod('document');
  };

  useEffect(() => {
    let active = true;
    load().catch((error) => { if (active) setMessage(error.message || 'Could not load verification details.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => companies.find((c) => c.slug === form.company), [companies, form.company]);
  const selectedVerification = useMemo(() => {
    if (!selected) return null;
    return verifications.find((v) => v.company_id === selected.id && v.employment_status === form.employmentStatus) || null;
  }, [verifications, selected, form.employmentStatus]);
  const alreadyVerified = isVerificationValid(selectedVerification);

  const startEmail = async (e) => {
    e.preventDefault();
    if (alreadyVerified) return;
    setBusy(true); setMessage('');
    try {
      const response = await authFetch('/api/verification/start', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not start verification.');
      setVerificationId(data.verificationId);
      setDevCode(data.devCode || '');
      setMessage(`Code sent to your ${selected?.name || 'company'} work email.`);
    } catch (error) {
      setMessage(error.message || 'Could not start verification.');
    } finally { setBusy(false); }
  };

  const confirm = async (e) => {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await authFetch('/api/verification/confirm', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ verificationId, code }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Verification failed.');
      setMessage('✓ Employment verified. Reviews for this workplace can now carry the Verified Employee badge.');
      setCode(''); setDevCode('');
      await load();
    } catch (error) {
      setMessage(error.message || 'Verification failed.');
    } finally { setBusy(false); }
  };

  const upload = async (e) => {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const fd = new FormData(e.currentTarget);
      const response = await authFetch('/api/verification/document', { method:'POST', body:fd });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed.');
      setMessage(data.message);
      await load();
    } catch (error) {
      setMessage(error.message || 'Upload failed.');
    } finally { setBusy(false); }
  };

  if (loading) return <><Nav/><main className="pageWrap verifyWrap"><div className="card emptyState">Loading your workplace verification…</div></main></>;

  return <><Nav/><main className="pageWrap verifyWrap">
    <div className="pageHero verifyHero">
      {fromOnboarding && <div className="verifyWelcome">Profile saved ✓</div>}
      <h1>Verify your workplace</h1>
      <p>LinkedOut verifies the employment relationship privately. Your work email or proof is never shown publicly.</p>
    </div>

    {selectedVerification && <div className={`card verificationStatusCard ${isVerificationValid(selectedVerification) ? 'valid' : selectedVerification.status}`}>
      <div><span className="verificationStatusIcon">{isVerificationValid(selectedVerification) ? '✓' : selectedVerification.status === 'pending' ? '◷' : '!'}</span></div>
      <div><b>{selectedVerification.company?.name || selected?.name || 'Workplace'} · {selectedVerification.employment_status === 'former' ? 'Former employee' : 'Current employee'}</b>
        <p>{isVerificationValid(selectedVerification)
          ? `Verified privately${selectedVerification.verified_until ? ` · valid until ${humanDate(selectedVerification.verified_until)}` : ''}.`
          : selectedVerification.status === 'pending' ? 'Verification is pending.' : `Previous verification is ${selectedVerification.status}. You can start a new verification below.`}</p>
      </div>
    </div>}

    <div className="methodTabs"><button className={method==='email'?'active':''} onClick={()=>{setMethod('email');setForm((value)=>({...value,employmentStatus:'current'}));setMessage('')}}>Work email</button><button className={method==='document'?'active':''} onClick={()=>{setMethod('document');setMessage('')}}>Employment document</button></div>

    {method==='email' && !verificationId && <form className="card reviewForm" onSubmit={startEmail}>
      <h2>{alreadyVerified ? 'Workplace already verified' : 'Fast verification'}</h2>
      <p>{alreadyVerified ? 'You do not need to verify this workplace again right now.' : 'We send a one-time code to a recognized company-domain email. The address itself is never stored in plain text.'}</p>
      <label>Company<select value={form.company} onChange={e=>setForm({...form,company:e.target.value})}>{companies.map(c=><option value={c.slug} key={c.slug}>{c.name}</option>)}</select></label>
      <label>Work email<input type="email" value={form.workEmail} onChange={e=>setForm({...form,workEmail:e.target.value})} placeholder={selected?.domain ? `you@${selected.domain}` : 'you@company.com'} required disabled={alreadyVerified}/></label>
      <div className="formRow"><label>Position<input value={form.role} onChange={e=>setForm({...form,role:e.target.value})} required disabled={alreadyVerified}/></label><label>Department<input value={form.department} onChange={e=>setForm({...form,department:e.target.value})} disabled={alreadyVerified}/></label></div>
      <div className="formRow"><label>Location<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} disabled={alreadyVerified}/></label><label>Status<select value="current" disabled><option value="current">Current employee</option></select><small className="fieldHelp">Former employment is verified with private documents instead of an active work email.</small></label></div>
      {message && <div className="authMessage">{message}</div>}
      {alreadyVerified ? <div className="verificationDoneActions"><Link className="button primary" href="/">Enter LinkedOut</Link><Link className="button secondary" href="/profile">View profile</Link></div> : <button className="button primary submit" disabled={busy}>{busy?'Sending…':'Send verification code'}</button>}
    </form>}

    {method==='email' && verificationId && <form className="card reviewForm" onSubmit={confirm}>
      <h2>Enter your code</h2><p>The code expires after 10 minutes and can be attempted at most five times.</p>
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
    <div className="verifyFoot"><Link href="/verify/university">Verify a university instead</Link><span> · </span><Link href="/profile">Back to profile</Link></div>
  </main></>;
}
