'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '../lib/authFetch';

export default function UniversityCombobox({ selectedUniversity, onSelect, placeholder = 'Search or type a university name' }) {
  const [query, setQuery] = useState(selectedUniversity?.name || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    if (selectedUniversity?.name && selectedUniversity.name !== query) setQuery(selectedUniversity.name);
    if (!selectedUniversity && !open) setQuery('');
    // Only sync after an external selection/clear. Typing is handled locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUniversity?.id]);

  useEffect(() => {
    if (!open) return;
    const normalized = query.trim();
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/universities?q=${encodeURIComponent(normalized)}&limit=8`);
        const data = await response.json();
        if (id !== requestId.current) return;
        if (!response.ok) throw new Error(data.error || 'Could not search universities.');
        setResults(Array.isArray(data.universities) ? data.universities : []);
      } catch (err) {
        if (id === requestId.current) {
          setResults([]);
          setError(err.message || 'Could not search universities.');
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, normalized ? 220 : 0);
    return () => clearTimeout(timer);
  }, [query, open]);

  const exactMatch = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return results.find((university) => university.name?.trim().toLocaleLowerCase() === normalized) || null;
  }, [results, query]);

  const choose = (university) => {
    setQuery(university.name);
    setOpen(false);
    setError('');
    onSelect(university);
  };

  const createUniversity = async () => {
    const name = query.trim();
    if (name.length < 2) return;
    setCreating(true);
    setError('');
    try {
      const response = await authFetch('/api/universities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not add that university.');
      choose(data.university);
    } catch (err) {
      setError(err.message || 'Could not add that university.');
    } finally {
      setCreating(false);
    }
  };

  const handleChange = (event) => {
    const next = event.target.value;
    setQuery(next);
    setOpen(true);
    setError('');
    if (selectedUniversity && next !== selectedUniversity.name) onSelect(null);
  };

  return <div className="companyCombobox universityCombobox">
    <div className={`companyComboInput ${open ? 'open' : ''}`}>
      <span aria-hidden="true">⌕</span>
      <input
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'Enter' && open && !exactMatch && query.trim().length >= 2) {
            event.preventDefault();
            createUniversity();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label="University"
      />
      {loading && <span className="companyComboSpinner" aria-label="Searching">…</span>}
    </div>

    {open && <div className="companyComboMenu" role="listbox">
      {results.map((university) => <button key={university.id} type="button" className="companyComboOption" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(university)}>
        <span className="companyComboLogo">🎓</span>
        <span><b>{university.name}</b><small>{[university.city, university.country].filter(Boolean).join(', ') || university.domain || 'LinkedOut university page'}</small></span>
      </button>)}

      {!loading && query.trim().length >= 2 && !exactMatch && <button type="button" className="companyComboCreate" onMouseDown={(e) => e.preventDefault()} onClick={createUniversity} disabled={creating}>
        <span>＋</span><span><b>{creating ? 'Adding university…' : `Add “${query.trim()}”`}</b><small>Not in LinkedOut yet? Add it to your profile.</small></span>
      </button>}

      {!loading && !results.length && query.trim().length < 2 && <div className="companyComboEmpty">Start typing a university name.</div>}
      {error && <div className="companyComboError">{error}</div>}
    </div>}

    {open && <button type="button" className="companyComboBackdrop" aria-label="Close university search" onClick={() => setOpen(false)} />}
  </div>;
}
