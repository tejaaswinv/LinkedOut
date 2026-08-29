import Link from 'next/link';
import EntityLogo from './EntityLogo';

export default function UniversityCard({ university, compact = false }) {
  const location = [university.city, university.country].filter(Boolean).join(', ') || 'Location not listed';
  const ranking = university.ranking_position
    ? `${university.ranking_provider || 'Global'} #${university.ranking_position}${university.ranking_year ? ` · ${university.ranking_year}` : ''}`
    : university.ranking_display || null;
  return <article className={`card universityCard ${compact ? 'compactUniversity' : ''}`}>
    <div className="universityCardHead">
      <EntityLogo src={university.logo_url} domain={university.domain} name={university.name} size={compact ? 'medium' : 'large'} />
      <div className="universityIdentity">
        <h2><Link href={`/university/${university.slug}`}>{university.name}</Link></h2>
        <p>{location}</p>
        <div className="entityBadges">
          {university.institution_type && <span>{university.institution_type}</span>}
          {university.domain && <span>{university.domain}</span>}
          {ranking && <span className="rankingBadge">{ranking}</span>}
        </div>
      </div>
    </div>
    {!compact && <>
      {university.description && <p className="entityDescription">{university.description}</p>}
      <div className="entityFacts">
        {university.founded_year && <div><small>Founded</small><b>{university.founded_year}</b></div>}
        {university.country && <div><small>Country</small><b>{university.country}</b></div>}
        {university.ror_id && <div><small>Open registry</small><b>ROR linked</b></div>}
        {university.domain && <div><small>Student email</small><b>Domain known</b></div>}
      </div>
      <Link className="entityOpenLink" href={`/university/${university.slug}`}>Open university page →</Link>
    </>}
  </article>;
}
