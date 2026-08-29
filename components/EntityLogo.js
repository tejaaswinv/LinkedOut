'use client';

import { useMemo, useState } from 'react';

function normalizeDomain(domain) {
  return String(domain || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
}

export default function EntityLogo({ src, domain, name, className = '', size = 'large' }) {
  const favicon = useMemo(() => {
    const normalized = normalizeDomain(domain);
    return normalized ? `https://${normalized}/favicon.ico` : null;
  }, [domain]);
  const candidates = [src, favicon].filter(Boolean);
  const [index, setIndex] = useState(0);
  const initial = name?.trim()?.slice(0, 1)?.toUpperCase() || '?';
  const current = candidates[index] || null;
  return <span className={`entityLogo entityLogo-${size} ${className}`.trim()} aria-label={`${name || 'Entity'} logo`}>
    {current ? <img src={current} alt="" onError={() => setIndex((value) => value + 1)} referrerPolicy="no-referrer" /> : <b>{initial}</b>}
  </span>;
}
