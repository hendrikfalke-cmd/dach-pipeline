'use client';

import { useState, useEffect, useCallback } from 'react';
import { DeadDeal } from '@/lib/types';
import Toast from '@/components/Toast';

export default function ArchivePage() {
  const [deals, setDeals] = useState<DeadDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchDeals = useCallback(() => {
    setLoading(true);
    fetch('/api/deals/archive')
      .then(r => r.json())
      .then(data => setDeals(Array.isArray(data) ? data : []))
      .catch(() => setDeals([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const filtered = deals.filter(d => {
    if (!searchInput) return true;
    const q = searchInput.toLowerCase();
    return (
      d.company?.toLowerCase().includes(q) ||
      d.industry?.toLowerCase().includes(q) ||
      d.owner?.toLowerCase().includes(q) ||
      d.archive_reason?.toLowerCase().includes(q)
    );
  });

  const handleRestore = async (deal: DeadDeal, targetTable: 'active_deals' | 'expected_deals') => {
    setRestoring(deal.id);
    try {
      const res = await fetch('/api/deals/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deal.id, target_table: targetTable }),
      });
      if (!res.ok) throw new Error('Failed');
      setToast({ message: `${deal.company} restored to ${targetTable === 'active_deals' ? 'Active' : 'Expected'}`, type: 'success' });
      fetchDeals();
    } catch {
      setToast({ message: 'Failed to restore deal', type: 'error' });
    }
    setRestoring(null);
  };

  return (
    <div className="px-4 lg:px-8 pt-5">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Dead Deals</h1>
        <p className="text-xs text-text-muted font-mono mt-0.5">
          {filtered.length} archived deal{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search company, reason, owner..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="w-full bg-bg-surface border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">
          {searchInput ? 'No archived deals match your search.' : 'No archived deals yet.'}
        </div>
      ) : (
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {filtered.map(deal => (
            <div key={deal.id} className="bg-bg-surface rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === deal.id ? null : deal.id)}
                className="w-full text-left p-4 flex items-start gap-3 active:bg-bg-elevated/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="text-[10px] font-mono font-semibold text-danger bg-danger/15 px-1.5 py-0.5 rounded whitespace-nowrap">DEAD</span>
                    {deal.archived_from && (
                      <span className="text-[10px] font-mono text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded whitespace-nowrap">
                        from {deal.archived_from === 'active_deals' ? 'Active' : 'Expected'}
                      </span>
                    )}
                    {deal.strategy && (
                      <span className="text-[10px] font-mono text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded whitespace-nowrap">{deal.strategy}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-text-primary truncate text-[15px]">{deal.company}</h3>
                  {deal.industry && <p className="text-xs text-text-secondary truncate mt-0.5">{deal.industry}</p>}
                </div>
                <div className="text-right shrink-0 ml-2">
                  {deal.ebitda && <span className="font-mono font-semibold text-text-muted text-sm">{deal.ebitda}</span>}
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {deal.archived_at ? new Date(deal.archived_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                  </div>
                  <svg className={`w-4 h-4 text-text-muted mt-1 ml-auto transition-transform ${expandedId === deal.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedId === deal.id && (
                <div className="px-4 pb-4 space-y-2.5 border-t border-border pt-3">
                  <div className="bg-warning/10 border border-warning/20 rounded-lg px-3 py-2.5">
                    <span className="text-[10px] font-mono uppercase text-warning block mb-1">Archive Reason</span>
                    <p className="text-sm text-text-primary leading-relaxed break-words">{deal.archive_reason}</p>
                  </div>

                  {deal.owner && <DetailRow label="Owner" value={deal.owner} />}
                  {deal.timing && <DetailRow label="Timing" value={deal.timing} />}
                  {deal.status && <DetailRow label="Status" value={deal.status} />}
                  {deal.origination && <DetailRow label="Origination" value={deal.origination} />}
                  {deal.advisors && <DetailRow label="Advisors" value={deal.advisors} />}

                  {deal.sponsors_interested && (
                    <div>
                      <span className="text-[10px] font-mono uppercase text-text-muted">Sponsors Interested</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {deal.sponsors_interested.split(',').map((s, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">{s.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {deal.sponsors_declined && (
                    <div>
                      <span className="text-[10px] font-mono uppercase text-text-muted">Sponsors Declined</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {deal.sponsors_declined.split(',').map((s, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-danger/15 text-danger font-medium">{s.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Restore actions */}
                  <div className="border-t border-border pt-3">
                    <p className="text-[10px] font-mono uppercase text-text-muted mb-2">Restore to</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestore(deal, 'active_deals')}
                        disabled={restoring === deal.id}
                        className="flex-1 text-sm font-medium text-center py-2.5 rounded-xl bg-accent-dim text-accent active:opacity-70 disabled:opacity-50"
                      >
                        {restoring === deal.id ? '...' : '→ Active'}
                      </button>
                      <button
                        onClick={() => handleRestore(deal, 'expected_deals')}
                        disabled={restoring === deal.id}
                        className="flex-1 text-sm font-medium text-center py-2.5 rounded-xl bg-secondary-dim text-secondary active:opacity-70 disabled:opacity-50"
                      >
                        {restoring === deal.id ? '...' : '→ Expected'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="overflow-hidden">
      <span className="text-[10px] font-mono uppercase text-text-muted">{label}</span>
      <p className="text-xs text-text-secondary leading-relaxed break-words">{value}</p>
    </div>
  );
}
