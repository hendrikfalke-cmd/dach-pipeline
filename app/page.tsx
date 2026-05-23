'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ActiveDeal, ExpectedDeal, DealTable } from '@/lib/types';
import { parseEbitda } from '@/lib/ebitda';
import DealCard from '@/components/DealCard';
import EditModal from '@/components/EditModal';
import Toast from '@/components/Toast';

type SortKey = 'updated' | 'company' | 'ebitda' | 'timing' | 'priority';
const STALE_DAYS = 14;

const PRIORITY_ORDER: Record<string, number> = { hot: 0, warm: 1, cold: 2 };

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<DealTable>('active_deals');
  const [deals, setDeals] = useState<(ActiveDeal | ExpectedDeal)[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editDeal, setEditDeal] = useState<{ deal: ActiveDeal | ExpectedDeal; table: DealTable } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [archiveDeal, setArchiveDeal] = useState<{ deal: ActiveDeal | ExpectedDeal; table: DealTable } | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiving, setArchiving] = useState(false);

  // Quick note
  const [quickNoteDeal, setQuickNoteDeal] = useState<{ deal: ActiveDeal | ExpectedDeal; table: DealTable } | null>(null);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [savingQuickNote, setSavingQuickNote] = useState(false);

  // Bulk actions
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);

  // Sorting & filters
  const [sortBy, setSortBy] = useState<SortKey>('updated');
  const [filterStrategy, setFilterStrategy] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);

  // What's new
  const [whatsNew, setWhatsNew] = useState<{ updated: number; added: number; notes: number } | null>(null);
  const [showWhatsNew, setShowWhatsNew] = useState(true);

  // Pull to refresh
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ table: activeTab });
      if (search) params.set('search', search);
      const res = await fetch(`/api/deals?${params}`);
      const data = await res.json();
      setDeals(Array.isArray(data) ? data : []);
    } catch {
      setDeals([]);
    }
    setLoading(false);
  }, [activeTab, search]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  // What's new
  useEffect(() => {
    const lastVisit = localStorage.getItem('pipeline_last_visit');
    const now = new Date().toISOString();
    if (lastVisit) {
      fetch(`/api/activity?limit=50`)
        .then(r => r.json())
        .then(items => {
          if (!Array.isArray(items)) return;
          const recent = items.filter((i: { created_at: string }) => i.created_at > lastVisit);
          if (recent.length > 0) {
            const added = recent.reduce((s: number, i: { deals_added: number }) => s + (i.deals_added || 0), 0);
            const updated = recent.reduce((s: number, i: { deals_updated: number }) => s + (i.deals_updated || 0), 0);
            const notesCt = recent.filter((i: { upload_type: string }) => i.upload_type === 'meeting_notes').length;
            if (added + updated + notesCt > 0) setWhatsNew({ updated, added, notes: notesCt });
          }
        }).catch(() => {});
    }
    localStorage.setItem('pipeline_last_visit', now);
  }, []);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && diff < 150) setPullDistance(diff);
  };
  const handleTouchEnd = async () => {
    if (pullDistance > 60) {
      setRefreshing(true);
      await fetchDeals();
      setRefreshing(false);
    }
    setPullDistance(0);
  };

  // Extract unique values for filter chips
  const { strategies, owners } = useMemo(() => {
    const stratSet = new Set<string>();
    const ownerSet = new Set<string>();
    deals.forEach(d => {
      const s = activeTab === 'active_deals' ? (d as ActiveDeal).strategy : (d as ExpectedDeal).expected_strategy;
      if (s) stratSet.add(s);
      if (d.owner) ownerSet.add(d.owner);
    });
    return { strategies: [...stratSet].sort(), owners: [...ownerSet].sort() };
  }, [deals, activeTab]);

  // Apply filters and sorting
  const displayDeals = useMemo(() => {
    let result = [...deals];

    if (filterStrategy) {
      result = result.filter(d => {
        const s = activeTab === 'active_deals' ? (d as ActiveDeal).strategy : (d as ExpectedDeal).expected_strategy;
        return s === filterStrategy;
      });
    }
    if (filterOwner) result = result.filter(d => d.owner === filterOwner);
    if (filterPriority) result = result.filter(d => d.priority === filterPriority);

    result.sort((a, b) => {
      switch (sortBy) {
        case 'company': return (a.company || '').localeCompare(b.company || '');
        case 'ebitda': return parseEbitda(b.ebitda) - parseEbitda(a.ebitda);
        case 'timing': return (a.timing || 'ZZZ').localeCompare(b.timing || 'ZZZ');
        case 'priority': {
          const pa = PRIORITY_ORDER[a.priority || 'warm'] ?? 1;
          const pb = PRIORITY_ORDER[b.priority || 'warm'] ?? 1;
          return pa - pb;
        }
        case 'updated':
        default: return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
      }
    });

    return result;
  }, [deals, filterStrategy, filterOwner, filterPriority, sortBy, activeTab]);

  const handleSave = async (data: Record<string, string>, table: DealTable, id?: string) => {
    const method = id ? 'PUT' : 'POST';
    const body = id ? { ...data, id, table } : { ...data, table };
    const res = await fetch('/api/deals', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Failed to save');
    setToast({ message: id ? 'Deal updated' : 'Deal added', type: 'success' });
    fetchDeals();
  };

  const handleArchive = async () => {
    if (!archiveDeal || !archiveReason.trim()) return;
    setArchiving(true);
    try {
      const res = await fetch('/api/deals/archive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: archiveDeal.deal.id, table: archiveDeal.table, archive_reason: archiveReason.trim() }) });
      if (!res.ok) throw new Error('Failed');
      setToast({ message: `${archiveDeal.deal.company} archived`, type: 'success' });
      setArchiveDeal(null); setArchiveReason(''); fetchDeals();
    } catch { setToast({ message: 'Failed to archive', type: 'error' }); }
    setArchiving(false);
  };

  const handleMove = async (deal: ActiveDeal | ExpectedDeal, fromTable: DealTable) => {
    const toTable: DealTable = fromTable === 'active_deals' ? 'expected_deals' : 'active_deals';
    const { id: _id, created_at: _ca, updated_at: _ua, priority: _p, ...rest } = deal as unknown as Record<string, unknown>;
    const moveData: Record<string, unknown> = { ...rest, table: toTable };
    if (fromTable === 'active_deals') {
      moveData.comment = rest.status || ''; moveData.expected_strategy = rest.strategy || '';
      delete moveData.status; delete moveData.strategy;
    } else {
      moveData.status = rest.comment || ''; moveData.strategy = rest.expected_strategy || 'MDF';
      delete moveData.comment; delete moveData.expected_strategy;
    }
    const createRes = await fetch('/api/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(moveData) });
    if (!createRes.ok) { setToast({ message: 'Failed to move', type: 'error' }); return; }
    await fetch('/api/deals', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: _id, table: fromTable }) });
    setToast({ message: `Moved to ${toTable === 'active_deals' ? 'Active' : 'Expected'}`, type: 'success' });
    fetchDeals();
  };

  const handlePriorityChange = async (deal: ActiveDeal | ExpectedDeal, table: DealTable, priority: string) => {
    // Optimistic update
    setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, priority: priority as ActiveDeal['priority'] } : d));
    fetch('/api/deals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deal.id, table, priority }) })
      .catch(() => fetchDeals()); // revert on error
  };

  const handleFieldUpdate = async (id: string, dealTable: DealTable, field: string, value: string) => {
    // Optimistic update
    setDeals(prev => prev.map(d => d.id === id ? { ...d, [field]: value } as typeof d : d));
    fetch('/api/deals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, table: dealTable, [field]: value }) })
      .catch(() => fetchDeals());
  };

  const handleQuickNoteSave = async () => {
    if (!quickNoteDeal || !quickNoteText.trim()) return;
    setSavingQuickNote(true);
    try {
      // Update the status/comment field with the quick note appended
      const isAct = quickNoteDeal.table === 'active_deals';
      const currentField = isAct ? (quickNoteDeal.deal as ActiveDeal).status : (quickNoteDeal.deal as ExpectedDeal).comment;
      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const updated = currentField
        ? `${currentField}\n[${dateStr}] ${quickNoteText.trim()}`
        : `[${dateStr}] ${quickNoteText.trim()}`;

      await fetch('/api/deals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: quickNoteDeal.deal.id,
          table: quickNoteDeal.table,
          [isAct ? 'status' : 'comment']: updated,
        }),
      });
      setToast({ message: 'Note added', type: 'success' });
      setQuickNoteDeal(null); setQuickNoteText('');
      fetchDeals();
    } catch { setToast({ message: 'Failed to save note', type: 'error' }); }
    setSavingQuickNote(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkArchive = async () => {
    const reason = prompt('Archive reason for selected deals:');
    if (!reason?.trim()) return;
    setBulkActing(true);
    for (const id of selectedIds) {
      await fetch('/api/deals/archive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, table: activeTab, archive_reason: reason.trim() }) });
    }
    setToast({ message: `${selectedIds.size} deals archived`, type: 'success' });
    setSelectedIds(new Set()); setBulkMode(false); setBulkActing(false);
    fetchDeals();
  };

  const handleBulkPriority = async (priority: string) => {
    setBulkActing(true);
    // Optimistic
    setDeals(prev => prev.map(d => selectedIds.has(d.id) ? { ...d, priority: priority as ActiveDeal['priority'] } : d));
    for (const id of selectedIds) {
      await fetch('/api/deals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, table: activeTab, priority }) });
    }
    setToast({ message: `${selectedIds.size} deals set to ${priority}`, type: 'success' });
    setSelectedIds(new Set()); setBulkMode(false); setBulkActing(false);
  };

  const handleBulkMove = async () => {
    setBulkActing(true);
    const toTable = activeTab === 'active_deals' ? 'expected_deals' : 'active_deals';
    for (const id of selectedIds) {
      const deal = deals.find(d => d.id === id);
      if (deal) await handleMove(deal, activeTab);
    }
    setSelectedIds(new Set()); setBulkMode(false); setBulkActing(false);
  };

  const totalEbitda = displayDeals.reduce((sum, d) => sum + parseEbitda(d.ebitda), 0);
  const hasFilters = filterStrategy || filterOwner || filterPriority;
  const staleCount = displayDeals.filter(d => {
    const days = d.updated_at ? Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000) : 999;
    return days >= STALE_DAYS;
  }).length;

  return (
    <div
      ref={scrollRef}
      className="px-4 lg:px-8 pt-5"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div className="flex justify-center mb-2" style={{ height: refreshing ? 40 : pullDistance * 0.4 }}>
          <div className={`w-5 h-5 border-2 border-accent border-t-transparent rounded-full ${refreshing ? 'animate-spin' : ''}`}
            style={{ opacity: Math.min(pullDistance / 60, 1) }}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Pipeline</h1>
          <p className="text-xs text-text-muted font-mono mt-0.5">
            {displayDeals.length} deals · ~{totalEbitda}m EBITDA
            {staleCount > 0 && <span className="text-danger"> · {staleCount} stale</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }} className={`w-10 h-10 rounded-xl flex items-center justify-center active:opacity-70 ${bulkMode ? 'bg-warning' : 'bg-bg-surface border border-border'}`}>
            <svg className={`w-5 h-5 ${bulkMode ? 'text-black' : 'text-text-muted'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button onClick={() => setShowNew(true)} className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center active:opacity-70">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </div>

      {/* What's new */}
      {whatsNew && showWhatsNew && (
        <div className="mb-4 bg-secondary/10 border border-secondary/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-secondary">Since your last visit</p>
            <p className="text-[11px] text-text-secondary mt-0.5">
              {[whatsNew.added > 0 && `${whatsNew.added} new`, whatsNew.updated > 0 && `${whatsNew.updated} updated`, whatsNew.notes > 0 && `${whatsNew.notes} note${whatsNew.notes > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button onClick={() => setShowWhatsNew(false)} className="text-text-muted shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input type="text" placeholder="Search company, industry, owner..." value={searchInput} onChange={e => setSearchInput(e.target.value)} className="w-full bg-bg-surface border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
      </div>

      {/* Sort + Filter */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[10px] font-mono text-text-muted shrink-0">Sort:</span>
          {([['updated', 'Recent'], ['priority', 'Priority'], ['company', 'A–Z'], ['ebitda', 'EBITDA ↓'], ['timing', 'Timing']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setSortBy(key)} className={`text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${sortBy === key ? 'bg-accent text-white' : 'bg-bg-surface text-text-muted border border-border'}`}>{label}</button>
          ))}
        </div>

        {/* Priority filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[10px] font-mono text-text-muted shrink-0">Priority:</span>
          {(['hot', 'warm', 'cold'] as const).map(p => (
            <button key={p} onClick={() => setFilterPriority(filterPriority === p ? null : p)} className={`text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${filterPriority === p ? 'bg-accent text-white' : 'bg-bg-surface text-text-muted border border-border'}`}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {strategies.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[10px] font-mono text-text-muted shrink-0">Strategy:</span>
            {strategies.map(s => (
              <button key={s} onClick={() => setFilterStrategy(filterStrategy === s ? null : s)} className={`text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${filterStrategy === s ? 'bg-accent text-white' : 'bg-bg-surface text-text-muted border border-border'}`}>{s}</button>
            ))}
          </div>
        )}

        {owners.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[10px] font-mono text-text-muted shrink-0">Owner:</span>
            {owners.map(o => (
              <button key={o} onClick={() => setFilterOwner(filterOwner === o ? null : o)} className={`text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${filterOwner === o ? 'bg-secondary text-white' : 'bg-bg-surface text-text-muted border border-border'}`}>{o}</button>
            ))}
          </div>
        )}

        {hasFilters && (
          <button onClick={() => { setFilterStrategy(null); setFilterOwner(null); setFilterPriority(null); }} className="text-[11px] text-danger font-medium">Clear filters</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('active_deals')} className={`flex-1 text-sm font-medium py-2.5 rounded-xl transition-colors ${activeTab === 'active_deals' ? 'bg-accent text-white' : 'bg-bg-surface text-text-muted border border-border'}`}>Active</button>
        <button onClick={() => setActiveTab('expected_deals')} className={`flex-1 text-sm font-medium py-2.5 rounded-xl transition-colors ${activeTab === 'expected_deals' ? 'bg-secondary text-white' : 'bg-bg-surface text-text-muted border border-border'}`}>Expected</button>
      </div>

      {/* Deal list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayDeals.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">
          {search || hasFilters ? 'No deals match your search/filters.' : 'No deals yet.'}
        </div>
      ) : (
        <>
        {/* Bulk action bar */}
        {bulkMode && selectedIds.size > 0 && (
          <div className="mb-3 flex items-center gap-2 bg-bg-surface rounded-xl border border-warning/30 p-3">
            <span className="text-xs font-mono text-warning shrink-0">{selectedIds.size} selected</span>
            <div className="flex-1" />
            <button onClick={() => handleBulkPriority('hot')} disabled={bulkActing} className="text-[10px] px-2 py-1 rounded bg-danger/15 text-danger font-bold">HOT</button>
            <button onClick={() => handleBulkPriority('cold')} disabled={bulkActing} className="text-[10px] px-2 py-1 rounded bg-blue-400/15 text-blue-400 font-bold">COLD</button>
            <button onClick={handleBulkMove} disabled={bulkActing} className="text-[10px] px-2 py-1 rounded bg-secondary-dim text-secondary font-bold">Move</button>
            <button onClick={handleBulkArchive} disabled={bulkActing} className="text-[10px] px-2 py-1 rounded bg-warning/15 text-warning font-bold">Archive</button>
          </div>
        )}

        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {displayDeals.map(deal => (
            <div key={deal.id} className="relative">
              {bulkMode && (
                <button
                  onClick={() => toggleSelect(deal.id)}
                  className={`absolute top-4 right-4 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedIds.has(deal.id) ? 'bg-accent border-accent' : 'border-border bg-bg-elevated'
                  }`}
                >
                  {selectedIds.has(deal.id) && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              )}
              <DealCard
                deal={deal}
                table={activeTab}
                onEdit={(d, t) => setEditDeal({ deal: d, table: t })}
                onArchive={(d, t) => { setArchiveDeal({ deal: d, table: t }); setArchiveReason(''); }}
                onMove={handleMove}
                onQuickNote={(d, t) => { setQuickNoteDeal({ deal: d, table: t }); setQuickNoteText(''); }}
                onPriorityChange={handlePriorityChange}
                onFieldUpdate={handleFieldUpdate}
              />
            </div>
          ))}
        </div>
        </>
      )}

      {editDeal && <EditModal deal={editDeal.deal} table={editDeal.table} onClose={() => setEditDeal(null)} onSave={handleSave} />}
      {showNew && <EditModal deal={null} table={activeTab} isNew onClose={() => setShowNew(false)} onSave={handleSave} />}

      {/* Archive Modal */}
      {archiveDeal && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16">
          <div className="absolute inset-0 bg-black/60" onClick={() => setArchiveDeal(null)} />
          <div className="relative w-[calc(100%-2rem)] max-w-lg bg-bg-surface rounded-2xl border border-border sheet-enter">
            <div className="p-5">
              <h3 className="font-semibold text-base mb-1">Archive {archiveDeal.deal.company}?</h3>
              <p className="text-sm text-text-secondary mb-4">This will move the deal to Dead Deals.</p>
              <label className="text-[11px] font-mono uppercase text-text-muted mb-1.5 block">Reason <span className="text-danger">*</span></label>
              <textarea value={archiveReason} onChange={e => setArchiveReason(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }} placeholder="e.g. Deal fell through, valuation too high..." className="w-full bg-bg-elevated border border-border rounded-xl px-3.5 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-warning resize-none mb-5" rows={2} />
              <div className="flex gap-3">
                <button onClick={() => setArchiveDeal(null)} className="flex-1 py-3.5 text-sm rounded-xl bg-bg-elevated text-text-primary font-medium active:opacity-70">Cancel</button>
                <button onClick={handleArchive} disabled={archiving || !archiveReason.trim()} className="flex-1 py-3.5 text-sm rounded-xl bg-warning text-black font-semibold active:opacity-70 disabled:opacity-50">{archiving ? 'Archiving...' : 'Archive'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Note Modal */}
      {quickNoteDeal && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16">
          <div className="absolute inset-0 bg-black/60" onClick={() => setQuickNoteDeal(null)} />
          <div className="relative w-[calc(100%-2rem)] max-w-lg bg-bg-surface rounded-2xl border border-border sheet-enter">
            <div className="p-5">
              <h3 className="font-semibold text-base mb-1">Quick note — {quickNoteDeal.deal.company}</h3>
              <p className="text-[11px] text-text-muted mb-3">This appends to the deal&apos;s status/comment field with today&apos;s date.</p>
              <textarea
                value={quickNoteText}
                onChange={e => setQuickNoteText(e.target.value)}
                placeholder="e.g. Called back, no answer / Waiting on CIM / DD materials received"
                className="w-full bg-bg-elevated border border-border rounded-xl px-3.5 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none mb-4"
                rows={3}
                autoFocus
              />
              <div className="flex gap-3">
                <button onClick={() => setQuickNoteDeal(null)} className="flex-1 py-3.5 text-sm rounded-xl bg-bg-elevated text-text-primary font-medium active:opacity-70">Cancel</button>
                <button onClick={handleQuickNoteSave} disabled={savingQuickNote || !quickNoteText.trim()} className="flex-1 py-3.5 text-sm rounded-xl bg-accent text-white font-semibold active:opacity-70 disabled:opacity-50">{savingQuickNote ? 'Saving...' : 'Add Note'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
