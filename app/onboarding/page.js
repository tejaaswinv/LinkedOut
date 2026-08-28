'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '../../components/Logo';
import { authFetch, requireFirebaseUser } from '../../lib/authFetch';

const initialForm = {
  username: '', employmentStatus: 'current', currentCompanyId: '', currentUniversityId: '',
  position: '', department: '', location: '', fieldOfStudy: '', graduationYear: '', bio: '',
  showCompany: true, showPosition: true, showDepartment: false, showLocation: true,
  showUniversity: true, showFieldOfStudy: true, showGraduationYear: false
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [companies, setCompanies] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      authFetch('/api/profile').then(async (r) => ({ status:r.status, ok:r.ok, data:await r.json() })),
      fetch('/api/companies?limit=100').then((r) => r.json()),
      fetch('/api/universities?limit=150').then((r) => r.json())
    ]).then(([profileResult, companyResult, universityResult]) => {
      if (!active) return;
      if (profileResult.status === 401) { router.replace('/login'); return; }
      if (!profileResult.ok) { setMessage(profileResult.data.error || 'Could not prepare onboarding.'); return; }
      const p = profileResult.data.profile || {};
      if (p.onboardingComplete) { router.replace('/'); return; }
      setForm({
        username:p.username||'', employmentStatus:p.employment_status||'current', currentCompanyId:p.current_company_id||'', currentUniversityId:p.current_university_id||'',
        position:p.position||'', department:p.department||'', location:p.location||'', fieldOfStudy:p.field_of_study||'', graduationYear:p.graduation_year||'', bio:p.bio||'',
        showCompany:p.show_company??true, showPosition:p.show_position??true, showDepartment:p.show_department??false, showLocation:p.show_location??true,
        showUniversity:p.show_university??true, showFieldOfStudy:p.show_field_of_study??true, showGraduationYear:p.show_graduation_year??false
      });
      setEmailVerified(Boolean(p.emailVerified));
      setCompanies(Array.isArray(companyResult.companies) ? companyResult.companies : []);
      setUniversities(Array.isArray(universityResult.universities) ? universityResult.universities : []);
    }).catch(() => setMessage('Could not prepare onboarding.')).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  const selectedCompany = useMemo(() => companies.find((c) => c.id === form.currentCompanyId), [companies, form.currentCompanyId]);
  const selectedUniversity = useMemo(() => universities.find((u) => u.id === form.currentUniversityId), [universities, form.currentUniversityId]);

  const validateStep = () => {
    setMessage('');
    if (step === 1 && !/^@[A-Za-z0-9_]{3,24}$/.test(form.username)) { setMessage('Choose an @username with 3-24 letters, numbers or underscores.'); return false; }
    if (step === 2 && ['current','former'].includes(form.employmentStatus) && !form.currentCompanyId) { setMessage('Choose your workplace, or select a different status.'); return false; }
    if (step === 2 && form.employmentStatus === 'student' && !form.currentUniversityId) { setMessage('Choose your university.'); return false; }
    if (form.graduationYear && (Number(form.graduationYear) < 1950 || Number(form.graduationYear) > 2100)) { setMessage('Enter a valid graduation year.'); return false; }
    return true;
  };

  const next = () => { if (validateStep()) setStep((v) => Math.min(3, v + 1)); };

  const finish = async (verifyAfter = false) => {
    if (!validateStep()) return;
    setBusy(true); setMessage('');
    try {
      const response = await authFetch('/api/profile', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
        ...form,
        currentCompanyId: form.currentCompanyId || null,
        currentUniversityId: form.currentUniversityId || null,
        graduationYear: form.graduationYear ? Number(form.graduationYear) : null,
        completeOnboarding:true
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not finish your profile.');
      if (verifyAfter && ['current','former'].includes(form.employmentStatus) && form.currentCompanyId) router.replace('/verify?from=onboarding');
      else if (verifyAfter && form.employmentStatus === 'student' && form.currentUniversityId) router.replace('/verify/university?from=onboarding');
      else router.replace('/');
      router.refresh();
    } catch (error) { setMessage(error.message || 'Could not finish your profile.'); }
    finally { setBusy(false); }
  };

  const refreshEmail = async () => { const user = await requireFirebaseUser(); if (!user) return router.replace('/login'); await user.reload(); await user.getIdToken(true); setEmailVerified(Boolean(user.emailVerified)); };

  if (loading) return <main className="onboardingLoading"><Logo/><p>Setting up your pseudonymous profile…</p></main>;

  const canVerify = (['current','former'].includes(form.employmentStatus) && form.currentCompanyId) || (form.employmentStatus === 'student' && form.currentUniversityId);
  const verifyLabel = form.employmentStatus === 'student' ? 'Save & verify university' : 'Save & verify workplace';

  return <main className="onboardingShell">
    <section className="onboardingBrand">
      <Link href="/"><Logo /></Link>
      <div className="onboardingProgress" aria-label={`Step ${step} of 3`}>{[1,2,3].map((n)=><span key={n} className={n<=step?'active':''}>{n}</span>)}</div>
      <p className="eyebrow">STEP {step} OF 3</p>
      <h1>{step===1?'Choose how LinkedOut knows you.':step===2?'Add only the context you want.':'You control what the public sees.'}</h1>
      <p>{step===1?'Your pseudonym is public. Your Firebase login identity stays private.':step===2?'Workplace or university context makes your contributions useful without publishing your real identity.':'These settings affect your profile card. Verification emails and documents are never public.'}</p>
      <div className="onboardingPrivacy"><b>Always private</b><span>Real name</span><span>Login email</span><span>Work/university verification email</span><span>Uploaded proof</span></div>
    </section>

    <section className="card onboardingCard">
      {step===1&&<><h2>Your public pseudonym</h2><p>This is the name coworkers, students and job seekers will see.</p><label>Public username<input autoFocus value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="@quarterly_crisis" /></label><label>Short bio <span className="optional">optional</span><textarea rows="3" value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} placeholder="e.g. CS student, former intern, interested in startup culture" /></label><div className={`onboardingTrust ${emailVerified?'verified':''}`}><span>{emailVerified?'✓':'○'}</span><div><b>{emailVerified?'Login email verified':'Login email verification pending'}</b><small>Your email address is not shown publicly.</small></div>{!emailVerified&&<button type="button" onClick={refreshEmail}>I verified it</button>}</div></>}

      {step===2&&<><h2>Professional or university context</h2><p>This is profile context, not affiliation verification yet. You can verify it after onboarding.</p>
        <label>Status<select value={form.employmentStatus} onChange={e=>{const s=e.target.value;setForm({...form,employmentStatus:s,currentCompanyId:['current','former'].includes(s)?form.currentCompanyId:'',currentUniversityId:s==='student'?form.currentUniversityId:''})}}><option value="current">Current employee</option><option value="former">Former employee</option><option value="between_roles">Between roles</option><option value="student">Student</option><option value="other">Other</option></select></label>
        {['current','former'].includes(form.employmentStatus)&&<label>Company<select value={form.currentCompanyId} onChange={e=>setForm({...form,currentCompanyId:e.target.value})}><option value="">Select a recognized company</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{selectedCompany&&<small className="fieldHelp">Recognized LinkedOut page · {selectedCompany.domain||selectedCompany.sector}</small>}</label>}
        {form.employmentStatus==='student'&&<><label>University<select value={form.currentUniversityId} onChange={e=>setForm({...form,currentUniversityId:e.target.value})}><option value="">Select a recognized university</option>{universities.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>{selectedUniversity&&<small className="fieldHelp">Recognized university · {selectedUniversity.domain||selectedUniversity.country}</small>}</label><div className="formRow"><label>Field of study <span className="optional">optional</span><input value={form.fieldOfStudy} onChange={e=>setForm({...form,fieldOfStudy:e.target.value})} placeholder="Computer Science" /></label><label>Graduation year <span className="optional">optional</span><input type="number" min="1950" max="2100" value={form.graduationYear} onChange={e=>setForm({...form,graduationYear:e.target.value})} placeholder="2029" /></label></div></>}
        {form.employmentStatus!=='student'&&<div className="formRow"><label>Position <span className="optional">optional</span><input value={form.position} onChange={e=>setForm({...form,position:e.target.value})} placeholder="Senior Analyst" /></label><label>Department <span className="optional">optional</span><input value={form.department} onChange={e=>setForm({...form,department:e.target.value})} placeholder="Operations" /></label></div>}
        <label>Location <span className="optional">optional</span><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Singapore" /></label>
      </>}

      {step===3&&<><h2>Public visibility</h2><p>Turn off anything that could make you too easy to identify. You can change this later.</p><div className="visibilityList">
        {form.employmentStatus==='student'?<><VisibilityToggle title="University" description={selectedUniversity?.name||'Your selected university'} checked={form.showUniversity} onChange={v=>setForm({...form,showUniversity:v})} disabled={!form.currentUniversityId}/><VisibilityToggle title="Field of study" description={form.fieldOfStudy||'No field added'} checked={form.showFieldOfStudy} onChange={v=>setForm({...form,showFieldOfStudy:v})} disabled={!form.fieldOfStudy}/><VisibilityToggle title="Graduation year" description={form.graduationYear||'No year added'} checked={form.showGraduationYear} onChange={v=>setForm({...form,showGraduationYear:v})} disabled={!form.graduationYear}/></>:<><VisibilityToggle title="Company" description={selectedCompany?.name||'Your selected workplace'} checked={form.showCompany} onChange={v=>setForm({...form,showCompany:v})} disabled={!form.currentCompanyId}/><VisibilityToggle title="Position" description={form.position||'No position added'} checked={form.showPosition} onChange={v=>setForm({...form,showPosition:v})} disabled={!form.position}/><VisibilityToggle title="Department" description={form.department||'No department added'} checked={form.showDepartment} onChange={v=>setForm({...form,showDepartment:v})} disabled={!form.department}/></>}
        <VisibilityToggle title="Location" description={form.location||'No location added'} checked={form.showLocation} onChange={v=>setForm({...form,showLocation:v})} disabled={!form.location}/>
      </div><div className="anonymityWarning"><b>Anonymity reminder:</b> A rare job title, niche course, exact graduation year or small location can identify you even when your name is hidden.</div></>}

      {message&&<div className="authMessage">{message}</div>}
      <div className="onboardingActions">{step>1?<button type="button" className="button secondary" onClick={()=>{setMessage('');setStep(step-1)}}>Back</button>:<span/>}{step<3?<button type="button" className="button primary" onClick={next}>Continue</button>:canVerify?<div className="onboardingFinishActions"><button type="button" className="button secondary" onClick={()=>finish(false)} disabled={busy}>Skip verification for now</button><button type="button" className="button primary" onClick={()=>finish(true)} disabled={busy}>{busy?'Saving…':verifyLabel}</button></div>:<button type="button" className="button primary" onClick={()=>finish(false)} disabled={busy}>{busy?'Saving…':'Enter LinkedOut'}</button>}</div>
    </section>
  </main>;
}

function VisibilityToggle({title,description,checked,onChange,disabled}){return <label className={`visibilityRow ${disabled?'disabled':''}`}><div><b>{title}</b><span>{description}</span></div><input type="checkbox" checked={!disabled&&checked} onChange={e=>onChange(e.target.checked)} disabled={disabled}/></label>}
