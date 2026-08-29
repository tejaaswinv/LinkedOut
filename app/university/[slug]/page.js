'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Nav from '../../../components/Nav';
import EntityLogo from '../../../components/EntityLogo';

function externalHref(value) {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export default function UniversityPage() {
  const { slug } = useParams();
  const [university, setUniversity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/universities?slug=${encodeURIComponent(slug)}&catalog=1`)
      .then((response) => response.json())
      .then((data) => { setUniversity(data.universities?.[0] || null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) return <><Nav/><main className="pageWrap"><div className="card emptyState">Loading university page…</div></main></>;
  if (!university) return <><Nav/><main className="pageWrap"><div className="card emptyState"><h2>University page not found.</h2><Link href="/universities">Browse universities</Link></div></main></>;

  const website = externalHref(university.website || university.domain);
  const rankLabel = university.ranking_position
    ? `#${university.ranking_position}${university.ranking_year ? ` (${university.ranking_year})` : ''}`
    : university.ranking_display;

  return <><Nav/><main className="entityPage">
    <section className="entityMain">
      <div className="card entityHeroCard">
        <div className="entityHeroTop">
          <EntityLogo src={university.logo_url} domain={university.domain} name={university.name} size="xl" />
          <div><span className="eyebrow">Independent university page</span><h1>{university.name}</h1><p>{[university.city, university.country].filter(Boolean).join(', ') || 'Location not listed'}</p></div>
        </div>
        <div className="entityBadges entityBadgesLarge">
          {university.institution_type && <span>{university.institution_type}</span>}
          {university.domain && <span>{university.domain}</span>}
          {rankLabel && <span className="rankingBadge">{university.ranking_provider || 'Ranking'} {rankLabel}</span>}
        </div>
        {university.description ? <p className="entityDescription entityDescriptionLarge">{university.description}</p> : <p className="entityDescription entityDescriptionLarge muted">Institution profile data is still being enriched from open sources.</p>}
        <div className="entityFacts entityFactsLarge">
          {university.founded_year && <div><small>Founded</small><b>{university.founded_year}</b></div>}
          {university.ranking_score != null && <div><small>Ranking score</small><b>{Number(university.ranking_score).toFixed(1)}</b></div>}
          {university.ror_id && <div><small>ROR</small><b>Open record linked</b></div>}
          <div><small>Student verification</small><b>{university.domain ? 'Email domain supported' : 'Domain pending'}</b></div>
        </div>
        <div className="entityHeroActions">
          {website && <a className="button secondary" href={website} target="_blank" rel="noreferrer">Official website ↗</a>}
          <Link className="button primary" href={`/verify/university?university=${encodeURIComponent(university.id)}`}>Verify student status</Link>
        </div>
      </div>
      <div className="card entityInfoCard"><h2>About this page</h2><p>LinkedOut maintains independent institution records so students can attach a real university to a pseudonymous profile. Universities do not need to register or control these pages.</p><p>Ranking data is displayed only when LinkedOut has permission to republish the source. Open registry metadata can be refreshed separately.</p></div>
    </section>
    <aside className="card entityAside">
      <h3>Privacy first</h3><p>Your university can be public while your login email and verification evidence stay private.</p><hr/>
      <h3>Data sources</h3>
      <p>{university.ror_id ? 'Institution metadata is linked to the Research Organization Registry (ROR).' : 'Open-source metadata has not been linked yet.'}</p>
      {university.wikipedia_url && <a href={university.wikipedia_url} target="_blank" rel="noreferrer">Wikipedia ↗</a>}
      {university.ranking_source_url && <a href={university.ranking_source_url} target="_blank" rel="noreferrer">Ranking source ↗</a>}
    </aside>
  </main></>;
}
