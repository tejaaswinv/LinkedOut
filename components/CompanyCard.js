import Link from 'next/link';
import EntityLogo from './EntityLogo';

function metricClass(v){ return v < 2.5 ? 'bad' : v < 3.3 ? 'mid' : 'good'; }
function metricText(v){return Number(v)>0?Number(v).toFixed(1):'—'}

export default function CompanyCard({ company, large = true }) {
  const hasReviews=Number(company.reviews)>0;
  const score=Number(company.score)||0;
  const issues=company.issues?.length?company.issues:(company.concerns||[]).slice(0,5);
  return <div className={`card companyCard ${large ? '' : 'compactCompany'}`}>
    <div className="companyHead">
      <EntityLogo src={company.logoUrl} domain={company.domain} name={company.name} size="large" className="companyEntityLogo" />
      <div className="companyIdentity">
        <h2>{company.name}</h2>
        <span>{company.sector} &nbsp;•&nbsp; {company.location}</span>
        <small>{hasReviews?`${company.reviews.toLocaleString()} published reviews · ${Number(company.employees||0).toLocaleString()} verified contributors`:`Recognized company page · ${company.domain||'domain pending'}`}</small>
        <div className="entityBadges companyMiniBadges">
          {company.foundedYear && <span>Founded {company.foundedYear}</span>}
          {company.ticker && <span>{company.exchange ? `${company.exchange}: ` : ''}{company.ticker}</span>}
          {company.rankingPosition && <span className="rankingBadge">{company.rankingProvider || 'Ranking'} #{company.rankingPosition}</span>}
        </div>
      </div>
      <div className="scoreBlock"><small>LinkedOut Score ⓘ</small><strong>{hasReviews?score.toFixed(1):'—'}<i>/5</i></strong><span className={!hasReviews?'neutralpill':score<2.8?'poor':score<3.5?'okay':'goodpill'}>{!hasReviews?'Not rated':score<2.8?'Poor':score<3.5?'Mixed':'Good'}</span></div>
      <div className="gauge"><div className="gaugeArc"></div><b>{company.rank||'Community score'}</b><span>{hasReviews?'from published stories':'waiting for reviews'}</span></div>
    </div>
    {large && <>
      <div className="metricGrid">
        {Object.entries(company.metrics||{}).map(([k,v])=><div className="metric" key={k}><span>{k}</span><b>{metricText(v)}</b><div className="meter"><i className={Number(v)>0?metricClass(Number(v)):'empty'} style={{width:`${Number(v)>0?Number(v)/5*100:0}%`}}></i></div></div>)}
      </div>
      <div className="aiSummary"><h3>✦ AI Summary</h3><p>{company.summary}</p>{issues.length?<><b>Recurring themes</b><div className="chips">{issues.map(x=><span key={x}>{x}</span>)}</div></>:<small>Summaries are generated only from published community reviews.</small>}</div>
      <Link className="viewReviews" href={`/company/${company.slug}`}>{hasReviews?`View employee experiences (${company.reviews.toLocaleString()})`:'Open company page'} →</Link>
    </>}
  </div>
}
