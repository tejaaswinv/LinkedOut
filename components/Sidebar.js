'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { profile as fallbackProfile } from '../lib/data';
import { authFetch } from '../lib/authFetch';

export default function Sidebar() {
  const [profile, setProfile] = useState(fallbackProfile);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(()=>{
    authFetch('/api/profile').then(async r=>({ok:r.ok,data:await r.json()})).then(({ok,data})=>{
      if(!ok) return;
      const p=data.profile;
      setSignedIn(true);
      setProfile({
        username:p.username,
        status:data.verifications?.some(v=>v.status==='verified')?'Verified Employee':p.emailVerified?'Verified Account':'Verification Pending',
        employer:p.currentCompany?.name || 'Professional context private',
        role:p.position || 'Add your position',
        location:p.location || 'Add your location'
      });
    }).catch(()=>{});
  },[]);
  return <aside className="leftcol">
    <div className="card profileCard">
      <div className="profileCover"></div>
      <div className="avatar huge">◕<span className="verifyDot">✓</span></div>
      <h2>{profile.username}</h2>
      <div className="verified">{profile.status || 'Verified Employee'}</div>
      <div className="profileMeta"><p>▦ {profile.employer}</p><p>◈ {profile.role}</p><p>⌖ {profile.location}</p></div>
      <Link className="button primary" href={signedIn?'/post':'/login'}>✎ Write Review</Link>
      <Link className="button secondary" href={signedIn?'/verify':'/login'}>{signedIn?'Verify Employment':'Sign in to verify'}</Link>
      <div className="privacyBox"><b>◆ Your personal identity stays private</b><span>Employer, title and location can be public. Name, phone, login email and proof stay private.</span></div>
    </div>
    <div className="card shortcuts">
      <h3>Shortcuts</h3>
      <Link href="/companies">▱ Saved Companies</Link>
      <Link href="/reviews">▤ Workplace Stories</Link>
      <Link href="/verify">◆ Employment Verification</Link>
      <Link href="/profile">⚙ Privacy & Profile</Link>
    </div>
    <div className="missionCard"><strong>Help others.<br/>Tell the truth.<br/>Make workplaces better.</strong><span>🚪→</span></div>
  </aside>;
}
