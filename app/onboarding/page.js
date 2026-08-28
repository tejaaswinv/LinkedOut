'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '../../components/Logo';
import { authFetch, requireFirebaseUser } from '../../lib/authFetch';

const initialForm = {
  username: '',
  employmentStatus: 'current',
  currentCompanyId: '',
  position: '',
  department: '',
  location: '',
  bio: '',
  showCompany: true,
  showPosition: true,
  showDepartment: false,
  showLocation: true
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [companies, setCompanies] = useState([]);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      authFetch('/api/profile').then(async (r) => ({ status: r.status, ok: r.ok, data: await r.json() })),
      fetch('/api/companies?limit=100').then((r) => r.json())
    ]).then(([profileResult, companyResult]) => {
      if (!active) return;
      if (profileResult.status === 401) {
        router.replace('/login');
        return;
      }
      if (!profileResult.ok) {
        setMessage(profileResult.data.error || 'Could not prepare onboarding.');
        return;
      }
      const p = profileResult.data.profile || {};
      if (p.onboardingComplete) {
        router.replace('/');
        return;
      }
      setForm({
        username: p.username || '',
        employmentStatus: p.employment_status || 'current',
        currentCompanyId: p.current_company_id || '',
        position: p.position || '',
        department: p.department || '',
        location: p.location || '',
        bio: p.bio || '',
        showCompany: p.show_company ?? true,
        showPosition: p.show_position ?? true,
        showDepartment: p.show_department ?? false,
        showLocation: p.show_location ?? true
      });
      setEmailVerified(Boolean(p.emailVerified));
      setCompanies(Array.isArray(companyResult.companies) ? companyResult.companies : []);
    }).catch(() => setMessage('Could not prepare onboarding.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === form.currentCompanyId),
    [companies, form.currentCompanyId]
  );

  const validateStep = () => {
    setMessage('');
    if (step === 1 && !/^@[A-Za-z0-9_]{3,24}$/.test(form.username)) {
      setMessage('Choose an @username with 3-24 letters, numbers or underscores.');
      return false;
    }
    if (step === 2 && ['current', 'former'].includes(form.employmentStatus) && !form.currentCompanyId) {
      setMessage('Choose your workplace, or select a different employment status.');
      return false;
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    setStep((value) => Math.min(3, value + 1));
  };

  const finish = async (verifyAfter = false) => {
    if (!validateStep()) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await authFetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          currentCompanyId: form.currentCompanyId || null,
          completeOnboarding: true
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not finish your profile.');
      const shouldVerify = verifyAfter && ['current','former'].includes(form.employmentStatus) && Boolean(form.currentCompanyId);
      router.replace(shouldVerify ? '/verify?from=onboarding' : '/');
      router.refresh();
    } catch (error) {
      setMessage(error.message || 'Could not finish your profile.');
    } finally {
      setBusy(false);
    }
  };

  const refreshEmail = async () => {
    const user = await requireFirebaseUser();
    if (!user) return router.replace('/login');
    await user.reload();
    await user.getIdToken(true);
    setEmailVerified(Boolean(user.emailVerified));
  };

  if (loading) {
    return <main className="onboardingLoading"><Logo/><p>Setting up your pseudonymous profile…</p></main>;
  }

  return <main className="onboardingShell">
    <section className="onboardingBrand">
      <Link href="/"><Logo /></Link>
      <div className="onboardingProgress" aria-label={`Step ${step} of 3`}>
        {[1,2,3].map((number) => <span key={number} className={number <= step ? 'active' : ''}>{number}</span>)}
      </div>
      <p className="eyebrow">STEP {step} OF 3</p>
      <h1>{step === 1 ? 'Choose how LinkedOut knows you.' : step === 2 ? 'Add only the work context you want.' : 'You control what the public sees.'}</h1>
      <p>{step === 1
        ? 'Your pseudonym is public. Your Firebase login identity stays private.'
        : step === 2
          ? 'Workplace context makes reviews useful without publishing your real identity.'
          : 'These settings affect your profile card. Verification emails and documents are never public.'}</p>
      <div className="onboardingPrivacy"><b>Always private</b><span>Real name</span><span>Login email</span><span>Work verification email</span><span>Uploaded employment proof</span></div>
    </section>

    <section className="card onboardingCard">
      {step === 1 && <>
        <h2>Your public pseudonym</h2>
        <p>This is the name coworkers and job seekers will see.</p>
        <label>Public username<input autoFocus value={form.username} onChange={(e) => setForm({...form, username:e.target.value})} placeholder="@quarterly_crisis" /></label>
        <label>Short bio <span className="optional">optional</span><textarea rows="3" value={form.bio} onChange={(e) => setForm({...form, bio:e.target.value})} placeholder="e.g. Operations, fintech, 6 years in regional teams" /></label>
        <div className={`onboardingTrust ${emailVerified ? 'verified' : ''}`}><span>{emailVerified ? '✓' : '○'}</span><div><b>{emailVerified ? 'Login email verified' : 'Login email verification pending'}</b><small>Your email address is not shown publicly.</small></div>{!emailVerified && <button type="button" onClick={refreshEmail}>I verified it</button>}</div>
      </>}

      {step === 2 && <>
        <h2>Professional context</h2>
        <p>This is not employment verification yet. You can verify the workplace after onboarding.</p>
        <label>Employment status<select value={form.employmentStatus} onChange={(e) => setForm({...form, employmentStatus:e.target.value, currentCompanyId:['current','former'].includes(e.target.value) ? form.currentCompanyId : ''})}><option value="current">Current employee</option><option value="former">Former employee</option><option value="between_roles">Between roles</option><option value="student">Student</option><option value="other">Other</option></select></label>
        {['current','former'].includes(form.employmentStatus) && <label>Company<select value={form.currentCompanyId} onChange={(e) => setForm({...form, currentCompanyId:e.target.value})}><option value="">Select a recognized company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>{selectedCompany && <small className="fieldHelp">Recognized LinkedOut page · {selectedCompany.domain || selectedCompany.sector}</small>}</label>}
        <div className="formRow"><label>Position <span className="optional">optional</span><input value={form.position} onChange={(e) => setForm({...form, position:e.target.value})} placeholder="Senior Analyst" /></label><label>Department <span className="optional">optional</span><input value={form.department} onChange={(e) => setForm({...form, department:e.target.value})} placeholder="Operations" /></label></div>
        <label>Location <span className="optional">optional</span><input value={form.location} onChange={(e) => setForm({...form, location:e.target.value})} placeholder="Singapore" /></label>
      </>}

      {step === 3 && <>
        <h2>Public visibility</h2>
        <p>Turn off anything that could make you too easy to identify. You can change this later.</p>
        <div className="visibilityList">
          <VisibilityToggle title="Company" description={selectedCompany?.name || 'Your selected workplace'} checked={form.showCompany} onChange={(value) => setForm({...form, showCompany:value})} disabled={!form.currentCompanyId}/>
          <VisibilityToggle title="Position" description={form.position || 'No position added'} checked={form.showPosition} onChange={(value) => setForm({...form, showPosition:value})} disabled={!form.position}/>
          <VisibilityToggle title="Department" description={form.department || 'No department added'} checked={form.showDepartment} onChange={(value) => setForm({...form, showDepartment:value})} disabled={!form.department}/>
          <VisibilityToggle title="Location" description={form.location || 'No location added'} checked={form.showLocation} onChange={(value) => setForm({...form, showLocation:value})} disabled={!form.location}/>
        </div>
        <div className="anonymityWarning"><b>Anonymity reminder:</b> A rare job title + small department + exact location can identify you even when your name is hidden. Keep only the context that is useful.</div>
      </>}

      {message && <div className="authMessage">{message}</div>}
      <div className="onboardingActions">
        {step > 1 ? <button type="button" className="button secondary" onClick={() => { setMessage(''); setStep(step - 1); }}>Back</button> : <span/>}
        {step < 3 ? <button type="button" className="button primary" onClick={next}>Continue</button> : ['current','former'].includes(form.employmentStatus) && form.currentCompanyId ? <div className="onboardingFinishActions"><button type="button" className="button secondary" onClick={() => finish(false)} disabled={busy}>Skip verification for now</button><button type="button" className="button primary" onClick={() => finish(true)} disabled={busy}>{busy ? 'Saving…' : 'Save & verify workplace'}</button></div> : <button type="button" className="button primary" onClick={() => finish(false)} disabled={busy}>{busy ? 'Saving…' : 'Enter LinkedOut'}</button>}
      </div>
    </section>
  </main>;
}

function VisibilityToggle({ title, description, checked, onChange, disabled }) {
  return <label className={`visibilityRow ${disabled ? 'disabled' : ''}`}>
    <div><b>{title}</b><span>{description}</span></div>
    <input type="checkbox" checked={!disabled && checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled}/>
  </label>;
}
