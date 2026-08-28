'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import Logo from './Logo';
import { getFirebaseAuth } from '../lib/firebase/client';

const items = [
  ['/', '⌂', 'Home'],
  ['/companies', '▦', 'Companies'],
  ['/reviews', '▤', 'Reviews'],
  ['/post', '✎', 'Post']
];

export default function Nav() {
  const path = usePathname();
  const [user, setUser] = useState(undefined);
  useEffect(()=>{
    const auth=getFirebaseAuth();
    if(!auth){setUser(null);return;}
    return onAuthStateChanged(auth,(next)=>setUser(next||null),()=>setUser(null));
  },[]);
  return (
    <header className="topbar">
      <Link href="/" className="logoLink"><Logo compact /></Link>
      <div className="topSearch"><span>⌕</span><input placeholder="Search companies, roles, or workplaces" onKeyDown={e=>{if(e.key==='Enter'&&e.currentTarget.value.trim())window.location.href=`/companies?q=${encodeURIComponent(e.currentTarget.value.trim())}`}}/></div>
      <nav className="navlinks">
        {items.map(([href, icon, label]) => (
          <Link href={href} key={href} className={path === href ? 'active' : ''}>
            <span className="navicon">{icon}</span><span>{label}</span>
          </Link>
        ))}
        <a href="#notifications"><span className="navicon">♢</span><span>Alerts</span></a>
        {user ? <Link href="/profile"><span className="avatar mini">◕</span><span>Me</span></Link> : <Link href="/login" className={path==='/login'?'active':''}><span className="navicon">♙</span><span>Sign in</span></Link>}
      </nav>
    </header>
  );
}
