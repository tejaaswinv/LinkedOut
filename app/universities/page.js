'use client';

import { useEffect, useState } from 'react';
import Nav from '../../components/Nav';
import UniversityCard from '../../components/UniversityCard';

export default function UniversitiesPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/universities?q=${encodeURIComponent(q.trim())}&limit=60&catalog=1`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load universities.');
        setItems(Array.isArray(data.universities) ? data.universities : []);
      } catch (err) {
        setItems([]);
        setError(err.message || 'Could not load universities.');
      } finally {
        setLoading(false);
      }
    }, q.trim() ? 220 : 0);
    return () => clearTimeout(timer);
  }, [q]);

  return <><Nav/><main className="pageWrap">
    <div className="pageHero catalogHero">
      <div><span className="eyebrow">University directory</span><h1>University pages</h1><p>Open institution records, student-verification context and community pages — independent of the university.</p></div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search universities, countries, cities or domains" />
    </div>
    <div className="directoryMeta"><b>{items.length}</b> results <span>· Search the catalog or type a university during onboarding if it is missing.</span></div>
    {error && <div className="card emptyState"><p>{error}</p></div>}
    {loading && !items.length ? <div className="card emptyState">Loading university directory…</div> : <div className="universityGrid">{items.map((university) => <UniversityCard key={university.id} university={university} compact />)}</div>}
  </main></>;
}
