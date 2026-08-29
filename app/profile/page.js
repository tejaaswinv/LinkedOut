'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { sendEmailVerification, signOut } from 'firebase/auth';
import Nav from '../../components/Nav';
import CompanyCombobox from '../../components/CompanyCombobox';
import UniversityCombobox from '../../components/UniversityCombobox';
import { authFetch, requireFirebaseUser } from '../../lib/authFetch';
import { getFirebaseAuth } from '../../lib/firebase/client';

export default function Profile(){
  const router=useRouter();
  const [loading,setLoading]=useState(true);
  const [selectedCompany,setSelectedCompany]=useState(null);
  const [selectedUniversity,setSelectedUniversity]=useState(null);
  const [form,setForm]=useState({username:'',bio:'',position:'',department:'',location:'',employmentStatus:'',currentCompanyId:'',currentUniversityId:'',fieldOfStudy:'',graduationYear:'',showCompany:true,showPosition:true,showDepartment:false,showLocation:true,showUniversity:true,showFieldOfStudy:true,showGraduationYear:false});
  const [verifications,setVerifications]=useState([]);
  const [studentVerifications,setStudentVerifications]=useState([]);
  const [emailVerified,setEmailVerified]=useState(false);
  const [message,setMessage]=useState('');
  const [emailMessage,setEmailMessage]=useState('');
  const [emailAction,setEmailAction]=useState('');

  const load=async()=>{
    const r=await authFetch('/api/profile');
    const d=await r.json();
    if(r.status===401){router.replace('/login');return;}
    if(!r.ok){setMessage(d.error||'Could not load profile.');setLoading(false);return;}
    const p=d.profile||{};
    if(!p.onboardingComplete){router.replace('/onboarding');return;}
    setForm({username:p.username||'',bio:p.bio||'',position:p.position||'',department:p.department||'',location:p.location||'',employmentStatus:p.employment_status||'',currentCompanyId:p.current_company_id||'',currentUniversityId:p.current_university_id||'',fieldOfStudy:p.field_of_study||'',graduationYear:p.graduation_year||'',showCompany:p.show_company??true,showPosition:p.show_position??true,showDepartment:p.show_department??false,showLocation:p.show_location??true,showUniversity:p.show_university??true,showFieldOfStudy:p.show_field_of_study??true,showGraduationYear:p.show_graduation_year??false});
    setSelectedCompany(p.currentCompany||null);
    setSelectedUniversity(p.currentUniversity||null);
    setVerifications(d.verifications||[]);
    setStudentVerifications(d.studentVerifications||[]);
    setEmailVerified(Boolean(p.emailVerified));
    setLoading(false);
  };
  useEffect(()=>{load().catch(()=>setLoading(false))},[]);

  const save=async(e)=>{e.preventDefault();setMessage('');const r=await authFetch('/api/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,currentCompanyId:form.currentCompanyId||null,currentUniversityId:form.currentUniversityId||null,graduationYear:form.graduationYear?Number(form.graduationYear):null})});const d=await r.json();setMessage(r.ok?'Profile and privacy settings saved.':d.error||'Could not save profile.');};
  const signOutNow=async()=>{const auth=getFirebaseAuth();if(auth)await signOut(auth);router.push('/');router.refresh();};
  const resend=async()=>{
    setEmailMessage('');
    setEmailAction('resend');
    const user=await requireFirebaseUser();
    if(!user){setEmailAction('');router.push('/login');return;}
    try{
      // Do not set a continue URL here. Firebase then uses its hosted action handler
      // and the button works across localhost, preview deployments and the canonical domain.
      await sendEmailVerification(user);
      setEmailMessage(`Verification email sent to ${user.email||'your login email'}. Check spam too.`);
    }catch(error){
      const code=String(error?.code||'');
      if(code==='auth/too-many-requests')setEmailMessage('Too many verification attempts. Wait a few minutes, then try again.');
      else if(code==='auth/network-request-failed')setEmailMessage('Network error while contacting Firebase. Check your connection and try again.');
      else setEmailMessage(error?.message||'Could not send verification email.');
    }finally{setEmailAction('');}
  };
  const refreshVerification=async()=>{
    setEmailMessage('');
    setEmailAction('refresh');
    const user=await requireFirebaseUser();
    if(!user){setEmailAction('');router.push('/login');return;}
    try{
      await user.reload();
      if(!user.emailVerified){
        setEmailVerified(false);
        setEmailMessage('Firebase still shows this email as unverified. Open the verification link first, then try again.');
        return;
      }
      await user.getIdToken(true);
      setEmailVerified(true);
      setEmailMessage('Email verified ✓ Updating your LinkedOut account…');
      await load();
    }catch(error){
      setEmailMessage(error?.message||'Could not refresh verification status.');
    }finally{setEmailAction('');}
  };

  if(loading)return <><Nav/><main className="pageWrap narrow"><div className="card emptyState">Loading your private profile…</div></main></>;
  const isStudent=form.employmentStatus==='student';
  const isEmployee=['current','former'].includes(form.employmentStatus);
  return <><Nav/><main className="pageWrap narrow"><div className="card profilePage"><div className="profileCover tall"></div><div className="avatar profileHero">◕{emailVerified&&<span className="verifyDot">✓</span>}</div><h1>{form.username}</h1><div className="verified">{emailVerified?'Verified account':'Email verification pending'}</div>
    {!emailVerified&&<div className="emailVerifyPanel"><p>Your login email stays private. Verify it to strengthen account trust.</p><div className="inlineActions"><button type="button" className="button secondary" onClick={resend} disabled={Boolean(emailAction)}>{emailAction==='resend'?'Sending…':'Resend email'}</button><button type="button" className="button secondary" onClick={refreshVerification} disabled={Boolean(emailAction)}>{emailAction==='refresh'?'Checking…':'I verified it'}</button></div>{emailMessage&&<div className="emailVerifyStatus" role="status">{emailMessage}</div>}</div>}
    <form className="profileEdit" onSubmit={save}>
      <h3>Public context</h3>
      <label>Username<input value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></label>
      <label>Bio<textarea rows="3" value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} placeholder="What kind of work or study context do you know about?"/></label>
      <label>Status<select value={form.employmentStatus} onChange={e=>{const s=e.target.value;const keepCompany=['current','former'].includes(s);const keepUniversity=s==='student';if(!keepCompany)setSelectedCompany(null);if(!keepUniversity)setSelectedUniversity(null);setForm({...form,employmentStatus:s,currentCompanyId:keepCompany?form.currentCompanyId:'',currentUniversityId:keepUniversity?form.currentUniversityId:''})}}><option value="" disabled>Select your status</option><option value="current">Current employee</option><option value="former">Former employee</option><option value="between_roles">Between roles</option><option value="student">Student</option><option value="other">Other</option></select></label>
      {isStudent?<>
        <label>University<UniversityCombobox selectedUniversity={selectedUniversity} onSelect={(university)=>{setSelectedUniversity(university);setForm({...form,currentUniversityId:university?.id||''})}} />{selectedUniversity&&<small className="fieldHelp">{selectedUniversity.source==='user_submitted'?'New LinkedOut university entry · verification pending directory review':`LinkedOut university page${selectedUniversity.domain?` · ${selectedUniversity.domain}`:''}`}</small>}</label>
        <div className="formRow"><label>Field of study<input value={form.fieldOfStudy} onChange={e=>setForm({...form,fieldOfStudy:e.target.value})}/></label><label>Graduation year<input type="number" min="1950" max="2100" value={form.graduationYear} onChange={e=>setForm({...form,graduationYear:e.target.value})}/></label></div>
      </>:<>
        {isEmployee&&<label>Company<CompanyCombobox selectedCompany={selectedCompany} onSelect={(company)=>{setSelectedCompany(company);setForm({...form,currentCompanyId:company?.id||''})}} /></label>}
        <div className="formRow"><label>Position<input value={form.position} onChange={e=>setForm({...form,position:e.target.value})}/></label><label>Department<input value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></label></div>
      </>}
      <label>Location<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label>
      <h3>Public visibility</h3><p className="profileHelp">Hide any combination that could make your pseudonym easy to identify.</p>
      <div className="visibilityList compact">{isStudent?<><PrivacyToggle title="Show university" checked={form.showUniversity} onChange={value=>setForm({...form,showUniversity:value})}/><PrivacyToggle title="Show field of study" checked={form.showFieldOfStudy} onChange={value=>setForm({...form,showFieldOfStudy:value})}/><PrivacyToggle title="Show graduation year" checked={form.showGraduationYear} onChange={value=>setForm({...form,showGraduationYear:value})}/></>:<>{isEmployee&&<PrivacyToggle title="Show company" checked={form.showCompany} onChange={value=>setForm({...form,showCompany:value})}/>}<PrivacyToggle title="Show position" checked={form.showPosition} onChange={value=>setForm({...form,showPosition:value})}/><PrivacyToggle title="Show department" checked={form.showDepartment} onChange={value=>setForm({...form,showDepartment:value})}/></>}<PrivacyToggle title="Show location" checked={form.showLocation} onChange={value=>setForm({...form,showLocation:value})}/></div>
      {message&&<div className="authMessage">{message}</div>}<button className="button primary submit">Save public context</button>
    </form>
    <div className="privacyPanel">
      {isStudent?<><h3>University verification</h3>{studentVerifications.length?studentVerifications.map(v=><div className="verificationRow" key={v.id}><div><b>{v.university?.name||'University'}</b><span>{v.field_of_study||'Student'} · University email · {verificationDetail(v)}</span></div><em className={`status-${verificationDisplayStatus(v)}`}>{verificationDisplayStatus(v)}</em></div>):<p>No university verification yet.</p>}{selectedUniversity?.domain?<Link className="button secondary" href="/verify/university">Verify this university</Link>:selectedUniversity?<p className="profileHelp">This university was added manually. LinkedOut needs its official university email domain before email verification can be enabled.</p>:null}</>:isEmployee?<><h3>Employment verification</h3>{verifications.length?verifications.map(v=><div className="verificationRow" key={v.id}><div><b>{v.company?.name||'Company'}</b><span>{v.role_title||'Employee'} · {v.method==='work_email'?'Work email':'Private document'} · {verificationDetail(v)}</span></div><em className={`status-${verificationDisplayStatus(v)}`}>{verificationDisplayStatus(v)}</em></div>):<p>No employment verification yet.</p>}<Link className="button secondary" href="/verify">Verify this workplace</Link></>:<><h3>Affiliation verification</h3><p>Select Current employee, Former employee, or Student to verify an affiliation.</p></>}
      <h3>Always private</h3><div className="privacyGrid private"><span>Real name <b>Private</b></span><span>Phone number <b>Private</b></span><span>Login/work/student email <b>Private</b></span><span>Verification documents <b>Private</b></span></div>
      <button className="dangerLink" onClick={signOutNow}>Sign out</button>
    </div>
  </div></main></>}

function PrivacyToggle({title,checked,onChange}){return <label className="visibilityRow"><div><b>{title}</b></div><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/></label>}
function verificationDisplayStatus(v){if(v.status==='verified'&&v.verified_until&&new Date(v.verified_until).getTime()<Date.now())return 'expired';return v.status;}
function verificationDetail(v){const status=verificationDisplayStatus(v);if(status==='verified'&&v.verified_until)return `valid until ${new Date(v.verified_until).toLocaleDateString()}`;if(status==='verified')return 'verified';if(status==='pending')return 'pending';if(status==='rejected'&&v.review_note)return `rejected · ${v.review_note}`;return status;}
