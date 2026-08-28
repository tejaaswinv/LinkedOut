'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { sendEmailVerification, signOut } from 'firebase/auth';
import Nav from '../../components/Nav';
import { authFetch, requireFirebaseUser } from '../../lib/authFetch';
import { getFirebaseAuth } from '../../lib/firebase/client';

export default function Profile(){
  const router=useRouter();
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({username:'',bio:'',position:'',department:'',location:'',employmentStatus:'current',currentCompanyId:null});
  const [verifications,setVerifications]=useState([]);
  const [emailVerified,setEmailVerified]=useState(false);
  const [message,setMessage]=useState('');

  const load=async()=>{
    const r=await authFetch('/api/profile');
    const d=await r.json();
    if(r.status===401){router.replace('/login');return;}
    if(!r.ok){setMessage(d.error||'Could not load profile.');setLoading(false);return;}
    const p=d.profile||{};
    setForm({username:p.username||'',bio:p.bio||'',position:p.position||'',department:p.department||'',location:p.location||'',employmentStatus:p.employment_status||'current',currentCompanyId:p.current_company_id||null});
    setVerifications(d.verifications||[]);
    setEmailVerified(Boolean(p.emailVerified));
    setLoading(false);
  };
  useEffect(()=>{load().catch(()=>setLoading(false))},[]);

  const save=async(e)=>{e.preventDefault();setMessage('');const r=await authFetch('/api/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const d=await r.json();setMessage(r.ok?'Profile saved.':d.error||'Could not save profile.');};
  const signOutNow=async()=>{const auth=getFirebaseAuth();if(auth)await signOut(auth);router.push('/');router.refresh();};
  const resend=async()=>{
    setMessage('');
    const user=await requireFirebaseUser();
    if(!user){router.push('/login');return;}
    try{await sendEmailVerification(user,{url:`${window.location.origin}/profile`});setMessage('Verification email sent.');}
    catch(error){setMessage(error.message||'Could not send verification email.');}
  };
  const refreshVerification=async()=>{
    const user=await requireFirebaseUser();
    if(!user)return;
    await user.reload();
    await user.getIdToken(true);
    await load();
  };

  if(loading)return <><Nav/><main className="pageWrap narrow"><div className="card emptyState">Loading your private profile…</div></main></>;
  return <><Nav/><main className="pageWrap narrow"><div className="card profilePage"><div className="profileCover tall"></div><div className="avatar profileHero">◕{emailVerified&&<span className="verifyDot">✓</span>}</div><h1>{form.username}</h1><div className="verified">{emailVerified?'Verified account':'Email verification pending'}</div>
    {!emailVerified&&<div className="emailVerifyPanel"><p>Your login email stays private. Verify it to strengthen account trust.</p><div className="inlineActions"><button type="button" className="button secondary" onClick={resend}>Resend email</button><button type="button" className="button secondary" onClick={refreshVerification}>I verified it</button></div></div>}
    <form className="profileEdit" onSubmit={save}>
      <h3>Public professional context</h3>
      <label>Username<input value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></label>
      <label>Bio<textarea rows="3" value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} placeholder="What kind of work do you know about?"/></label>
      <div className="formRow"><label>Position<input value={form.position} onChange={e=>setForm({...form,position:e.target.value})}/></label><label>Department<input value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></label></div>
      <div className="formRow"><label>Location<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label><label>Status<select value={form.employmentStatus} onChange={e=>setForm({...form,employmentStatus:e.target.value})}><option value="current">Current employee</option><option value="former">Former employee</option><option value="between_roles">Between roles</option><option value="student">Student</option><option value="other">Other</option></select></label></div>
      {message&&<div className="authMessage">{message}</div>}<button className="button primary submit">Save public context</button>
    </form>
    <div className="privacyPanel"><h3>Employment verification</h3>{verifications.length?verifications.map(v=><div className="verificationRow" key={v.id}><div><b>{v.company?.name||'Company'}</b><span>{v.role_title||'Employee'} · {v.method==='work_email'?'Work email':'Private document'}</span></div><em className={`status-${v.status}`}>{v.status}</em></div>):<p>No employment verification yet.</p>}<Link className="button secondary" href="/verify">Verify a workplace</Link>
      <h3>Always private</h3><div className="privacyGrid private"><span>Real name <b>Private</b></span><span>Phone number <b>Private</b></span><span>Login/work email <b>Private</b></span><span>Verification documents <b>Private</b></span></div>
      <button className="dangerLink" onClick={signOutNow}>Sign out</button>
    </div>
  </div></main></>}
