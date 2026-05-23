'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ActiveDeal, ExpectedDeal, DeadDeal } from '@/lib/types';

interface SponsorSummary {
  name: string;
  interested: number;
  declined: number;
  advising: number;
  total: number;
}

interface SponsorDetail {
  name: string;
  interestedDeals: (ActiveDeal | ExpectedDeal)[];
  declinedDeals: (ActiveDeal | ExpectedDeal)[];
  advisingDeals: (ActiveDeal | ExpectedDeal)[];
  deadDeals: DeadDeal[];
  totalDeals: number;
}

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<SponsorSummary[]>([]);
  const [selectedSponsor, setSelectedSponsor] = useState<SponsorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/sponsors')
      .then(r => r.json())
      .then(data => setSponsors(Array.isArray(data) ? data : []))
      .catch(() => setSponsors([]))
      .finally(() => setLoading(false));
  }, []);

  const loadSponsor = async (name: string) => {
    if (selectedSponsor?.name === name) { setSelectedSponsor(null); return; }
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/sponsors?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      setSelectedSponsor(data);
    } catch { /* ignore */ }
    setLoadingDetail(false);
  };

  const filtered = sponsors.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-4 lg:px-8 pt-5">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Sponsors & Advisors</h1>
        <p className="text-xs text-text-muted font-mono mt-0.5">{sponsors.length} entities across your pipeline</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input type="text" placeholder="Search sponsor or advisor..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-bg-surface border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sponsor => (
            <div key={sponsor.name}>
              <button
                onClick={() => loadSponsor(sponsor.name)}
                className={`w-full text-left bg-bg-surface rounded-xl border p-4 active:bg-bg-elevated/50 transition-colors ${selectedSponsor?.name === sponsor.name ? 'border-accent' : 'border-border'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary truncate">{sponsor.name}</h3>
                    <div className="flex gap-3 mt-1">
                      {sponsor.interested > 0 && <span className="text-[10px] font-mono text-accent">{sponsor.interested} interested</span>}
                      {sponsor.declined > 0 && <span className="text-[10px] font-mono text-danger">{sponsor.declined} declined</span>}
                      {sponsor.advising > 0 && <span className="text-[10px] font-mono text-secondary">{sponsor.advising} advising</span>}
                    </div>
                  </div>
                  <span className="text-lg font-bold font-mono text-text-muted shrink-0 ml-3">{sponsor.total}</span>
                </div>
              </button>

              {/* Expanded detail */}
              {selectedSponsor?.name === sponsor.name && !loadingDetail && (
                <div className="bg-bg-elevated rounded-xl border border-border mt-1 p-4 space-y-4">
                  {selectedSponsor.interestedDeals.length > 0 && (
                    <DealSection title="Interested In" deals={selectedSponsor.interestedDeals} color="text-accent" />
                  )}
                  {selectedSponsor.declinedDeals.length > 0 && (
                    <DealSection title="Declined" deals={selectedSponsor.declinedDeals} color="text-danger" />
                  )}
                  {selectedSponsor.advisingDeals.length > 0 && (
                    <DealSection title="Advising" deals={selectedSponsor.advisingDeals} color="text-secondary" />
                  )}
                  {selectedSponsor.deadDeals.length > 0 && (
                    <div>
                      <p className="text-[10px] font-mono uppercase text-text-muted mb-1.5">Dead Deals</p>
                      {selectedSponsor.deadDeals.map(d => (
                        <div key={d.id} className="flex items-center gap-3 py-1.5">
                          <p className="text-xs text-text-muted flex-1 truncate line-through">{d.company}</p>
                          <span className="text-[10px] text-text-muted font-mono">{d.ebitda}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {selectedSponsor?.name === sponsor.name && loadingDetail && (
                <div className="flex justify-center py-4"><div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DealSection({ title, deals, color }: { title: string; deals: (ActiveDeal | ExpectedDeal)[]; color: string }) {
  return (
    <div>
      <p className={`text-[10px] font-mono uppercase ${color} mb-1.5`}>{title} ({deals.length})</p>
      {deals.map(d => (
        <div key={d.id} className="flex items-center gap-3 py-1.5">
          <Link href={`/deals/${d.id}`} className="text-xs text-text-primary font-medium flex-1 truncate hover:text-accent">{d.company}</Link>
          <span className="text-[10px] text-text-muted font-mono">{d.ebitda}</span>
          <span className="text-[10px] text-text-muted">{d.industry}</span>
        </div>
      ))}
    </div>
  );
}
