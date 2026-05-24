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
  const [activeDeals, setActiveDeals]     = useState<ActiveDeal[]>([]);
  const [expectedDeals, setExpectedDeals] = useState<ExpectedDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [editDeal, setEditDeal] = useState<{ deal: ActiveDeal | ExpectedDeal; table: DealTable } | null>(null);
  const [showNew, setShowNew]   = useState<{ table: DealTable } | null>(null);
  const [toast, setToast]       = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [archiveDeal, setArchiveDeal]   = useState<{ deal: ActiveDeal | ExpectedDeal; table: DealTable } | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiving, setArchiving]         = useState(false);

  const [quickNoteDeal, setQuickNoteDeal] = useState<{ deal: ActiveDeal | ExpectedDeal; table: DealTable } | null>(null);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [savingQuickNote, setSavingQuickNote] = useState(false);

  // Bulk actions — track which table is in bulk mode
  const [bulkTable, setBulkTable]   = useState<DealTable | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing]   = useState(false);

  // Sort & filters (shared across both sections)
  const [sortBy, setSortBy]               = useState<SortKey>('updated');
  const [filterStrategy, setFilterStrategy] = useState<string | null>(null);
  const [filterOwner, setFilterOwner]       = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);

  // What's new
  const [whatsNew, setWhatsNew]     = useState<{ updated: number; added: number; notes: number } | null>(null);
  const [showWhatsNew, setShowWhatsNew] = useState(true);

  // Pull to refresh
  const [refreshing, setRefreshing]   = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);

  // ── Fetch both tables in parallel ──────────────────────────────────────────
  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const params = search ? `&search=${encodeURIComponent(search)}` : '';
      const [activeRes, expectedRes] = await Promise.all([
        fetch(`/api/deals?table=active_deals${params}`),
        fetch(`/api/deals?table=expected_deals${params}`),
      ]);
      const [activeData, expectedData] = await Promise.all([
        activeRes.json(),
        expectedRes.json(),
      ]);
      setActiveDeals(Array.isArray(activeData) ? activeData : []);
      setExpectedDeals(Array.isArray(expectedData) ? expectedData : []);
    } catch {
      setActiveDeals([]);
      setExpectedDeals([]);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  // What's new
  useEffect(() => {
    const lastVisit = localStorage.getItem('pipeline_last_visit');
    const now = new Date().toISOString();
    if (lastVisit) {
      fetch('/api/activity?limit=50')
        .then(r => r.json())
        .then(items => {
          if (!Array.isArray(items)) return;
          const recent = items.filter((i: { created_at: string }) => i.created_at > lastVisit);
          if (recent.length > 0) {
            const added   = recent.reduce((s: number, i: { deals_added: number }) => s + (i.deals_added || 0), 0);
            const updated = recent.reduce((s: number, i: { deals_updated: number }) => s + (i.deals_updated || 0), 0);
            const notesCt = recent.filter((i: { upload_type: string }) => i.upload_type === 'meeting_notes').length;
            if (added + updated + notesCt > 0) setWhatsNew({ updated, added, notes: notesCt });
          }
        }).catch(() => {});
    }
    localStorage.setItem('pipeline_last_visit', now);
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Pull-to-refresh
  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchMove  = (e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && diff < 150) setPullDistance(diff);
  };
  const handleTouchEnd = async () => {
    if (pullDistance > 60) { setRefreshing(true); await fetchDeals(); setRefreshing(false); }
    setPullDistance(0);
  };

  // ── Filter helpers ──────────────────────────────────────────────────────────
  const applyFiltersAndSort = useCallback(<T extends ActiveDeal | ExpectedDeal>(
    deals: T[],
    table: DealTable
  ): T[] => {
    let result = [...deals];
    if (filterStrategy) {
      result = result.filter(d => {
        const s = table === 'active_deals'
          ? (d as ActiveDeal).strategy
          : (d as ExpectedDeal).expected_strategy;
        return s === filterStrategy;
      });
    }
    if (filterOwner)    result = result.filter(d => d.owner === filterOwner);
    if (filterPriority) result = result.filter(d => d.priority === filterPriority);
    result.sort((a, b) => {
      switch (sortBy) {
        case 'company':  return (a.company || '').localeCompare(b.company || '');
        case 'ebitda':   return parseEbitda(b.ebitda) - parseEbitda(a.ebitda);
        case 'timing':   return (a.timing || 'ZZZ').localeCompare(b.timing || 'ZZZ');
        case 'priority': return (PRIORITY_ORDER[a.priority || 'warm'] ?? 1) - (PRIORITY_ORDER[b.priority || 'warm'] ?? 1);
        default:         return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
      }
    });
    return result;
  }, [filterStrategy, filterOwner, filterPriority, sortBy]);

  const displayActive   = useMemo(() => applyFiltersAndSort(activeDeals,   'active_deals'),   [activeDeals,   applyFiltersAndSort]);
  const displayExpected = useMemo(() => applyFiltersAndSort(expectedDeals, 'expected_deals'), [expectedDeals, applyFiltersAndSort]);

  // Unique filter chip values across both tables
  const { strategies, owners } = useMemo(() => {
    const stratSet = new Set<string>();
    const ownerSet = new Set<string>();
    activeDeals.forEach(d => { if (d.strategy) stratSet.add(d.strategy); if (d.owner) ownerSet.add(d.owner); });
    expectedDeals.forEach(d => { if (d.expected_strategy) stratSet.add(d.expected_strategy); if (d.owner) ownerSet.add(d.owner); });
    return { strategies: [...stratSet].sort(), owners: [...ownerSet].sort() };
  }, [activeDeals, expectedDeals]);

  const totalEbitda = useMemo(() => {
    const ae = displayActive.reduce((s, d) => s + parseEbitda(d.ebitda), 0);
    const ee = displayExpected.reduce((s, d) => s + parseEbitda(d.ebitda), 0);
    return ae + ee;
  }, [displayActive, displayExpected]);

  const staleCount = useMemo(() => {
    const isStale = (d: { updated_at: string }) =>
      Math.floor((Date.now() - new Date(d.updated_at || 0).getTime()) / 86400000) >= STALE_DAYS;
    return [...displayActive, ...displayExpected].filter(isStale).length;
  }, [displayActive, displayExpected]);

  const hasFilters = filterStrategy || filterOwner || filterPriority;

  // ── Action handlers ─────────────────────────────────────────────────────────
  const handleSave = async (data: Record<string, string>, table: DealTable, id?: string) => {
    const method = id ? 'PUT' : 'POST';
    const body   = id ? { ...data, id, table } : { ...data, table };
    const res    = await fetch('/api/deals', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Failed to save');
    setToast({ message: id ? 'Deal updated' : 'Deal added', type: 'success' });
    fetchDeals();
  };

  const handleArchive = async () => {
    if (!archiveDeal || !archiveReason.trim()) return;
    setArchiving(true);
    try {
      const res = await fetch('/api/deals/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: archiveDeal.deal.id, table: archiveDeal.table, archive_reason: archiveReason.trim() }),
      });
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
    const setter = table === 'active_deals' ? setActiveDeals : setExpectedDeals;
    (setter as (fn: (prev: (ActiveDeal | ExpectedDeal)[]) => (ActiveDeal | ExpectedDeal)[]) => void)(
      prev => prev.map(d => d.id === deal.id ? { ...d, priority: priority as ActiveDeal['priority'] } : d)
    );
    fetch('/api/deals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deal.id, table, priority }) })
      .catch(() => fetchDeals());
  };

  const handleFieldUpdate = async (id: string, table: DealTable, field: string, value: string) => {
    const setter = table === 'active_deals' ? setActiveDeals : setExpectedDeals;
    (setter as (fn: (prev: (ActiveDeal | ExpectedDeal)[]) => (ActiveDeal | ExpectedDeal)[]) => void)(
      prev => prev.map(d => d.id === id ? { ...d, [field]: value } as typeof d : d)
    );
    fetch('/api/deals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, table, [field]: value }) })
      .catch(() => fetchDeals());
  };

  const handleQuickNoteSave = async () => {
    if (!quickNoteDeal || !quickNoteText.trim()) return;
    setSavingQuickNote(true);
    try {
      const isAct = quickNoteDeal.table === 'active_deals';
      const currentField = isAct ? (quickNoteDeal.deal as ActiveDeal).status : (quickNoteDeal.deal as ExpectedDeal).comment;
      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const updated = currentField
        ? `${currentField}\n[${dateStr}] ${quickNoteText.trim()}`
        : `[${dateStr}] ${quickNoteText.trim()}`;
      await fetch('/api/deals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: quickNoteDeal.deal.id, table: quickNoteDeal.table, [isAct ? 'status' : 'comment']: updated }),
      });
      setToast({ message: 'Note added', type: 'success' });
      setQuickNoteDeal(null); setQuickNoteText('');
      fetchDeals();
    } catch { setToast({ message: 'Failed to save note', type: 'error' }); }
    setSavingQuickNote(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const clearBulk = () => { setSelectedIds(new Set()); setBulkTable(null); };

  const handleBulkArchive = async () => {
    if (!bulkTable) return;
    const reason = prompt('Archive reason for selected deals:');
    if (!reason?.trim()) return;
    setBulkActing(true);
    for (const id of selectedIds) {
      await fetch('/api/deals/archive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, table: bulkTable, archive_reason: reason.trim() }) });
    }
    setToast({ message: `${selectedIds.size} deals archived`, type: 'success' });
    clearBulk(); setBulkActing(false); fetchDeals();
  };

  const handleBulkPriority = async (priority: string) => {
    if (!bulkTable) return;
    setBulkActing(true);
    const setter = bulkTable === 'active_deals' ? setActiveDeals : setExpectedDeals;
    (setter as (fn: (prev: (ActiveDeal | ExpectedDeal)[]) => (ActiveDeal | ExpectedDeal)[]) => void)(
      prev => prev.map(d => selectedIds.has(d.id) ? { ...d, priority: priority as ActiveDeal['priority'] } : d)
    );
    for (const id of selectedIds) {
      await fetch('/api/deals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, table: bulkTable, priority }) });
    }
    setToast({ message: `${selectedIds.size} deals set to ${priority}`, type: 'success' });
    clearBulk(); setBulkActing(false);
  };

  const handleBulkMove = async () => {
    if (!bulkTable) return;
    setBulkActing(true);
    const allDeals = bulkTable === 'active_deals' ? activeDeals : expectedDeals;
    for (const id of selectedIds) {
      const deal = allDeals.find(d => d.id === id);
      if (deal) await handleMove(deal, bulkTable);
    }
    clearBulk(); setBulkActing(false);
  };

  // ── Section component ───────────────────────────────────────────────────────
  const renderSection = (
    deals: (ActiveDeal | ExpectedDeal)[],
    table: DealTable,
    label: string,
    accentClass: string,
  ) => {
    const sectionEbitda = deals.reduce((s, d) => s + parseEbitda(d.ebitda), 0);
    const isBulkSection = bulkTable === table;

    return (
      <div className="mb-6">
        {/* Section header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className={`text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded ${accentClass}`}>
              {label}
            </span>
            <span className="text-xs text-text-muted font-mono">
              {deals.length} · ~{sectionEbitda}m
            </span>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                if (isBulkSection) { clearBulk(); } else { setBulkTable(table); setSelectedIds(new Set()); }
              }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center active:opacity-70 ${isBulkSection ? 'bg-warning text-black' : 'bg-bg-surface border border-border text-text-muted'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={() => setShowNew({ table })}
              className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center active:opacity-70"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Bulk action bar */}
        {isBulkSection && selectedIds.size > 0 && (
          <div className="mb-3 flex items-center gap-2 bg-bg-surface rounded-xl border border-warning/30 p-3">
            <span className="text-xs font-mono text-warning shrink-0">{selectedIds.size} selected</span>
            <div className="flex-1" />
            <button onClick={() => handleBulkPriority('hot')}  disabled={bulkActing} className="text-[10px] px-2 py-1 rounded bg-danger/15 text-danger font-bold">HOT</button>
            <button onClick={() => handleBulkPriority('cold')} disabled={bulkActing} className="text-[10px] px-2 py-1 rounded bg-blue-400/15 text-blue-400 font-bold">COLD</button>
            <button onClick={handleBulkMove}    disabled={bulkActing} className="text-[10px] px-2 py-1 rounded bg-secondary-dim text-secondary font-bold">Move</button>
            <button onClick={handleBulkArchive} disabled={bulkActing} className="text-[10px] px-2 py-1 rounded bg-warning/15 text-warning font-bold">Archive</button>
          </div>
        )}

        {deals.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6">
            {search || hasFilters ? 'No matches.' : `No ${label.toLowerCase()} deals.`}
          </p>
        ) : (
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            {deals.map(deal => (
              <div key={deal.id} className="relative">
                {isBulkSection && (
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
                  table={table}
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
        )}
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="px-4 lg:px-8 pt-5"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh */}
      {(pullDistance > 0 || refreshing) && (
        <div className="flex justify-center mb-2" style={{ height: refreshing ? 40 : pullDistance * 0.4 }}>
          <div
            className={`w-5 h-5 border-2 border-accent border-t-transparent rounded-full ${refreshing ? 'animate-spin' : ''}`}
            style={{ opacity: Math.min(pullDistance / 60, 1) }}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Pipeline</h1>
          <p className="text-xs text-text-muted font-mono mt-0.5">
            {displayActive.length + displayExpected.length} deals · ~{totalEbitda}m EBITDA
            {staleCount > 0 && <span className="text-danger"> · {staleCount} stale</span>}
          </p>
        </div>
      </div>

      {/* What's new */}
      {whatsNew && showWhatsNew && (
        <div className="mb-4 bg-secondary/10 border border-secondary/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-secondary">Since your last visit</p>
            <p className="text-[11px] text-text-secondary mt-0.5">
              {[
                whatsNew.added > 0   && `${whatsNew.added} new`,
                whatsNew.updated > 0 && `${whatsNew.updated} updated`,
                whatsNew.notes > 0   && `${whatsNew.notes} note${whatsNew.notes > 1 ? 's' : ''}`,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button onClick={() => setShowWhatsNew(false)} className="text-text-muted shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search company, industry, owner…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="w-full bg-bg-surface border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      </div>

      {/* Sort + Filters */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[10px] font-mono text-text-muted shrink-0">Sort:</span>
          {([['updated', 'Recent'], ['priority', 'Priority'], ['company', 'A–Z'], ['ebitda', 'EBITDA ↓'], ['timing', 'Timing']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setSortBy(key)} className={`text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${sortBy === key ? 'bg-accent text-white' : 'bg-bg-surface text-text-muted border border-border'}`}>
              {label}
            </button>
          ))}
        </div>

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
              <button key={s} onClick={() => setFilterStrategy(filterStrategy === s ? null : s)} className={`text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${filterStrategy === s ? 'bg-accent text-white' : 'bg-bg-surface text-text-muted border border-border'}`}>
                {s}
              </button>
            ))}
          </div>
        )}

        {owners.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[10px] font-mono text-text-muted shrink-0">Owner:</span>
            {owners.map(o => (
              <button key={o} onClick={() => setFilterOwner(filterOwner === o ? null : o)} className={`text-[11px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${filterOwner === o ? 'bg-secondary text-white' : 'bg-bg-surface text-text-muted border border-border'}`}>
                {o}
              </button>
            ))}
          </div>
        )}

        {hasFilters && (
          <button onClick={() => { setFilterStrategy(null); setFilterOwner(null); setFilterPriority(null); }} className="text-[11px] text-danger font-medium">
            Clear filters
          </button>
        )}
      </div>

      {/* Deal sections */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {renderSection(displayActive,   'active_deals',   'Active',   'bg-accent/15 text-accent')}
          {renderSection(displayExpected, 'expected_deals', 'Expected', 'bg-secondary/15 text-secondary')}
        </>
      )}

      {/* Modals */}
      {editDeal && (
        <EditModal deal={editDeal.deal} table={editDeal.table} onClose={() => setEditDeal(null)} onSave={handleSave} />
      )}
      {showNew && (
        <EditModal deal={null} table={showNew.table} isNew onClose={() => setShowNew(null)} onSave={handleSave} />
      )}

      {/* Archive modal */}
      {archiveDeal && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16">
          <div className="absolute inset-0 bg-black/60" onClick={() => setArchiveDeal(null)} />
          <div className="relative w-[calc(100%-2rem)] max-w-lg bg-bg-surface rounded-2xl border border-border sheet-enter">
            <div className="p-5">
              <h3 className="font-semibold text-base mb-1">Archive {archiveDeal.deal.company}?</h3>
              <p className="text-sm text-text-secondary mb-4">This will move the deal to Dead Deals.</p>
              <label className="text-[11px] font-mono uppercase text-text-muted mb-1.5 block">Reason <span className="text-danger">*</span></label>
              <textarea
                value={archiveReason}
                onChange={e => setArchiveReason(e.target.value)}
                placeholder="e.g. Deal fell through, valuation too high…"
                className="w-full bg-bg-elevated border border-border rounded-xl px-3.5 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-warning resize-none mb-5"
                rows={2}
              />
              <div className="flex gap-3">
                <button onClick={() => setArchiveDeal(null)} className="flex-1 py-3.5 text-sm rounded-xl bg-bg-elevated text-text-primary font-medium active:opacity-70">Cancel</button>
                <button onClick={handleArchive} disabled={archiving || !archiveReason.trim()} className="flex-1 py-3.5 text-sm rounded-xl bg-warning text-black font-semibold active:opacity-70 disabled:opacity-50">
                  {archiving ? 'Archiving…' : 'Archive'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick note modal */}
      {quickNoteDeal && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16">
          <div className="absolute inset-0 bg-black/60" onClick={() => setQuickNoteDeal(null)} />
          <div className="relative w-[calc(100%-2rem)] max-w-lg bg-bg-surface rounded-2xl border border-border sheet-enter">
            <div className="p-5">
              <h3 className="font-semibold text-base mb-1">Quick note — {quickNoteDeal.deal.company}</h3>
              <p className="text-[11px] text-text-muted mb-3">Appends to the deal&apos;s status/comment with today&apos;s date.</p>
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
                <button onClick={handleQuickNoteSave} disabled={savingQuickNote || !quickNoteText.trim()} className="flex-1 py-3.5 text-sm rounded-xl bg-accent text-white font-semibold active:opacity-70 disabled:opacity-50">
                  {savingQuickNote ? 'Saving…' : 'Add Note'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
