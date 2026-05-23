'use client';

import { useState, useEffect } from 'react';
import { ActiveDeal, ExpectedDeal, DeadDeal, ActivityItem } from '@/lib/types';
import Link from 'next/link';

const STALE_DAYS = 14;

export default function DigestPage() {
  const [activeDeals, setActiveDeals] = useState<ActiveDeal[]>([]);
  const [expectedDeals, setExpectedDeals] = useState<ExpectedDeal[]>([]);
  const [deadDeals, setDeadDeals] = useState<DeadDeal[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/deals?table=active_deals').then(r => r.json()),
      fetch('/api/deals?table=expected_deals').then(r => r.json()),
      fetch('/api/deals/archive').then(r => r.json()),
      fetch('/api/activity?limit=50').then(r => r.json()),
    ]).then(([active, expected, dead, act]) => {
      setActiveDeals(Array.isArray(active) ? active : []);
      setExpectedDeals(Array.isArray(expected) ? expected : []);
      setDeadDeals(Array.isArray(dead) ? dead : []);
      setActivity(Array.isArray(act) ? act : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;
  }

  const allDeals = [...activeDeals, ...expectedDeals];
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 86400000).toISOString();

  // This week's activity
  const weekActivity = activity.filter(a => a.created_at > weekAgo);
  const weekAdded = weekActivity.reduce((s, a) => s + (a.deals_added || 0), 0);
  const weekUpdated = weekActivity.reduce((s, a) => s + (a.deals_updated || 0), 0);
  const weekNotes = weekActivity.filter(a => a.upload_type === 'meeting_notes').length;
  const weekArchived = deadDeals.filter(d => d.archived_at > weekAgo).length;

  // Stale deals
  const staleDeals = allDeals.filter(d => {
    const days = d.updated_at ? Math.floor((now - new Date(d.updated_at).getTime()) / 86400000) : 999;
    return days >= STALE_DAYS;
  }).sort((a, b) => new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime());

  // Recently updated
  const recentlyUpdated = allDeals
    .filter(d => d.updated_at > weekAgo && d.updated_at !== d.created_at)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10);

  // New this week
  const newThisWeek = allDeals
    .filter(d => d.created_at > weekAgo)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Hot deals
  const hotDeals = allDeals.filter(d => d.priority === 'hot');

  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="px-4 lg:px-8 pt-5 pb-8">
      <div className="mb-5">
        <h1 className="text-xl font-bold">Weekly Digest</h1>
        <p className="text-xs text-text-muted font-mono mt-0.5">{dateStr}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <SummaryCard label="New Deals" value={weekAdded} color="text-accent" />
        <SummaryCard label="Updated" value={weekUpdated} color="text-secondary" />
        <SummaryCard label="Notes Added" value={weekNotes} color="text-secondary" />
        <SummaryCard label="Archived" value={weekArchived} color="text-warning" />
      </div>

      {/* Hot deals */}
      {hotDeals.length > 0 && (
        <Section title="Hot Deals" icon="🔥" count={hotDeals.length}>
          {hotDeals.map(d => (
            <DealRow key={d.id} deal={d} />
          ))}
        </Section>
      )}

      {/* Stale deals - needs attention */}
      {staleDeals.length > 0 && (
        <Section title="Needs Attention" icon="" count={staleDeals.length} danger>
          <p className="text-[11px] text-text-muted mb-2">Not updated in {STALE_DAYS}+ days</p>
          {staleDeals.map(d => {
            const days = Math.floor((now - new Date(d.updated_at).getTime()) / 86400000);
            return (
              <div key={d.id} className="flex items-center gap-3 py-2">
                <Link href={`/deals/${d.id}`} className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary font-medium truncate">{d.company}</p>
                  <p className="text-[10px] text-text-muted">{d.owner || 'No owner'}</p>
                </Link>
                <span className="text-[10px] font-mono text-danger font-bold shrink-0">{days}d ago</span>
              </div>
            );
          })}
        </Section>
      )}

      {/* New this week */}
      {newThisWeek.length > 0 && (
        <Section title="New This Week" icon="" count={newThisWeek.length}>
          {newThisWeek.map(d => <DealRow key={d.id} deal={d} />)}
        </Section>
      )}

      {/* Recently updated */}
      {recentlyUpdated.length > 0 && (
        <Section title="Recently Updated" icon="" count={recentlyUpdated.length}>
          {recentlyUpdated.map(d => <DealRow key={d.id} deal={d} subtitle={`Updated ${formatTimeAgo(new Date(d.updated_at))}`} />)}
        </Section>
      )}

      {/* Pipeline snapshot */}
      <div className="bg-bg-surface rounded-xl border border-border p-4 mt-4">
        <h2 className="text-sm font-semibold mb-3">Pipeline Snapshot</h2>
        <div className="space-y-2 text-xs text-text-secondary">
          <div className="flex justify-between"><span>Active deals</span><span className="font-mono text-accent">{activeDeals.length}</span></div>
          <div className="flex justify-between"><span>Expected deals</span><span className="font-mono text-secondary">{expectedDeals.length}</span></div>
          <div className="flex justify-between"><span>Dead deals</span><span className="font-mono text-text-muted">{deadDeals.length}</span></div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold text-text-primary">
            <span>Total active EBITDA</span>
            <span className="font-mono text-accent">~{activeDeals.reduce((s, d) => { const m = d.ebitda?.match(/(\d+)/); return s + (m ? parseInt(m[1]) : 0); }, 0)}m</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-bg-surface rounded-xl border border-border p-3.5">
      <p className="text-[10px] font-mono uppercase text-text-muted mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}

function Section({ title, icon, count, danger, children }: { title: string; icon: string; count: number; danger?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-4 mb-4 ${danger ? 'bg-danger/5 border-danger/20' : 'bg-bg-surface border-border'}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-sm">{icon}</span>}
        <h2 className={`text-sm font-semibold ${danger ? 'text-danger' : ''}`}>{title}</h2>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${danger ? 'bg-danger/15 text-danger' : 'bg-bg-elevated text-text-muted'}`}>{count}</span>
      </div>
      {children}
    </div>
  );
}

function DealRow({ deal, subtitle }: { deal: ActiveDeal | ExpectedDeal; subtitle?: string }) {
  const priority = deal.priority;
  return (
    <div className="flex items-center gap-3 py-2">
      <Link href={`/deals/${deal.id}`} className="flex-1 min-w-0">
        <p className="text-sm text-text-primary font-medium truncate">{deal.company}</p>
        <p className="text-[10px] text-text-muted">{subtitle || deal.industry || deal.owner || ''}</p>
      </Link>
      {deal.ebitda && <span className="text-xs font-mono text-accent shrink-0">{deal.ebitda}</span>}
      {priority === 'hot' && <span className="text-[10px]">🔥</span>}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
