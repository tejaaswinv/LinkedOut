'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '../lib/authFetch';

export default function CompanyCombobox({ selectedCompany, onSelect, placeholder = 'Search or type a company name' }) {
  const [query, setQuery] = useState(selectedCompany?.name || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    if (selectedCompany?.name && selectedCompany.name !== query) setQuery(selectedCompany.name);
    if (!selectedCompany && !open) setQuery('');
    // Only sync after an external selection/clear. Typing is handled locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id]);

  useEffect(() => {
    if (!open) return;
    const normalized = query.trim();
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/companies?q=${encodeURIComponent(normalized)}&limit=8`);
        const data = await response.json();
        if (id !== requestId.current) return;
        if (!response.ok) throw new Error(data.error || 'Could not search companies.');
        setResults(Array.isArray(data.companies) ? data.companies : []);
      } catch (err) {
        if (id === requestId.current) {
          setResults([]);
          setError(err.message || 'Could not search companies.');
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, normalized ? 220 : 0);
    return () => clearTimeout(timer);
  }, [query, open]);

  const exactMatch = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return results.find((company) => company.name?.trim().toLocaleLowerCase() === normalized) || null;
  }, [results, query]);

  const choose = (company) => {
    setQuery(company.name);
    setOpen(false);
    setError('');
    onSelect(company);
  };

  const createCompany = async () => {
    const name = query.trim();
    if (name.length < 2) return;
    setCreating(true);
    setError('');
    try {
      const response = await authFetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not add that company.');
      choose(data.company);
    } catch (err) {
      setError(err.message || 'Could not add that company.');
    } finally {
      setCreating(false);
    }
  };

  const handleChange = (event) => {
    const next = event.target.value;
    setQuery(next);
    setOpen(true);
    setError('');
    if (selectedCompany && next !== selectedCompany.name) onSelect(null);
  };

  return <div className="companyCombobox">
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
            createCompany();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {loading && <span className="companyComboSpinner" aria-label="Searching">…</span>}
    </div>

    {open && <div className="companyComboMenu" role="listbox">
      {results.map((company) => <button key={company.id} type="button" className="companyComboOption" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(company)}>
        <span className="companyComboLogo">{company.name?.slice(0, 1)?.toUpperCase() || '?'}</span>
        <span><b>{company.name}</b><small>{company.domain || company.sector || company.location || 'LinkedOut company page'}</small></span>
      </button>)}

      {!loading && query.trim().length >= 2 && !exactMatch && <button type="button" className="companyComboCreate" onMouseDown={(e) => e.preventDefault()} onClick={createCompany} disabled={creating}>
        <span>＋</span><span><b>{creating ? 'Adding company…' : `Add “${query.trim()}”`}</b><small>Not in LinkedOut yet? Create its company page.</small></span>
      </button>}

      {!loading && !results.length && query.trim().length < 2 && <div className="companyComboEmpty">Start typing a company name.</div>}
      {error && <div className="companyComboError">{error}</div>}
    </div>}

    {open && <button type="button" className="companyComboBackdrop" aria-label="Close company search" onClick={() => setOpen(false)} />}
  </div>;
}
