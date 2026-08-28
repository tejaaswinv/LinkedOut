'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authFetch } from '../lib/authFetch';

export default function Sidebar() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    let active = true;
    authFetch('/api/profile')
      .then(async (response) => ({ httpStatus: response.status, ok: response.ok, data: await response.json() }))
      .then(({ httpStatus, ok, data }) => {
        if (!active) return;
        if (!ok) {
          setAuthRequired(httpStatus === 401);
          return;
        }

        const p = data.profile;
        const verifiedEmployment = data.verifications?.find((v) => v.status === 'verified');
        const status = verifiedEmployment
          ? verifiedEmployment.employment_status === 'former' ? 'Verified Former Employee' : 'Verified Employee'
          : p.emailVerified ? 'Verified Account' : 'Email verification pending';

        setProfile({
          username: p.username,
          status,
          employer: p.currentCompany?.name || 'Professional context private',
          role: p.position || 'Add your position',
          location: p.location || 'Add your location'
        });
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []);

  if (loading) {
    return <aside className="leftcol"><div className="card profileCard"><div className="profileCover"></div><div className="avatar huge">◕</div><h2>Loading your profile…</h2><div className="profileMeta"><p>Your public pseudonym and professional context will appear here.</p></div></div></aside>;
  }

  if (!profile) {
    return <aside className="leftcol"><div className="card profileCard"><div className="profileCover"></div><div className="avatar huge">◕</div><h2>{authRequired ? 'Sign in to LinkedOut' : 'Profile unavailable'}</h2><div className="profileMeta"><p>{authRequired ? 'Your pseudonymous profile appears after you sign in.' : 'We could not load your profile right now.'}</p></div><Link className="button primary" href={authRequired ? '/login' : '/profile'}>{authRequired ? 'Sign in' : 'Open profile'}</Link></div></aside>;
  }

  const isVerified = profile.status.startsWith('Verified');

  return <aside className="leftcol">
    <div className="card profileCard">
      <div className="profileCover"></div>
      <div className="avatar huge">◕{isVerified && <span className="verifyDot">✓</span>}</div>
      <h2>{profile.username}</h2>
      <div className="verified">{profile.status}</div>
      <div className="profileMeta"><p>▦ {profile.employer}</p><p>◈ {profile.role}</p><p>⌖ {profile.location}</p></div>
      <Link className="button primary" href="/post">✎ Write Review</Link>
      <Link className="button secondary" href="/verify">Verify Employment</Link>
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
