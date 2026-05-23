'use client';

import { useState, useEffect } from 'react';
import { ActiveDeal, ExpectedDeal, DeadDeal, ActivityItem } from '@/lib/types';
import { parseEbitda } from '@/lib/ebitda';

export default function StatsPage() {
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
      fetch('/api/activity?limit=10').then(r => r.json()),
    ]).then(([active, expected, dead, act]) => {
      setActiveDeals(Array.isArray(active) ? active : []);
      setExpectedDeals(Array.isArray(expected) ? expected : []);
      setDeadDeals(Array.isArray(dead) ? dead : []);
      setActivity(Array.isArray(act) ? act : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const allDeals = [...activeDeals, ...expectedDeals];
  const activeEbitda = activeDeals.reduce((s, d) => s + parseEbitda(d.ebitda), 0);
  const expectedEbitda = expectedDeals.reduce((s, d) => s + parseEbitda(d.ebitda), 0);

  // Strategy mix (all deals)
  const strategyMap = new Map<string, number>();
  activeDeals.forEach(d => { if (d.strategy) strategyMap.set(d.strategy, (strategyMap.get(d.strategy) || 0) + 1); });
  expectedDeals.forEach(d => { if (d.expected_strategy) strategyMap.set(d.expected_strategy, (strategyMap.get(d.expected_strategy) || 0) + 1); });
  const strategies = [...strategyMap.entries()].sort((a, b) => b[1] - a[1]);
  const maxStrategy = Math.max(...strategies.map(s => s[1]), 1);

  // Sponsors
  const sponsorMap = new Map<string, number>();
  allDeals.forEach(d => {
    d.sponsors_interested?.split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
      sponsorMap.set(s, (sponsorMap.get(s) || 0) + 1);
    });
  });
  const topSponsors = [...sponsorMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxSponsor = Math.max(...topSponsors.map(s => s[1]), 1);

  // Advisors
  const advisorMap = new Map<string, number>();
  allDeals.forEach(d => {
    d.advisors?.split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
      advisorMap.set(s, (advisorMap.get(s) || 0) + 1);
    });
  });
  const topAdvisors = [...advisorMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Owner distribution
  const ownerMap = new Map<string, number>();
  allDeals.forEach(d => { if (d.owner) ownerMap.set(d.owner, (ownerMap.get(d.owner) || 0) + 1); });
  const owners = [...ownerMap.entries()].sort((a, b) => b[1] - a[1]);
  const maxOwner = Math.max(...owners.map(o => o[1]), 1);

  // Industry breakdown
  const industryMap = new Map<string, number>();
  allDeals.forEach(d => { if (d.industry) industryMap.set(d.industry, (industryMap.get(d.industry) || 0) + 1); });
  const industries = [...industryMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxIndustry = Math.max(...industries.map(i => i[1]), 1);

  // Timing distribution
  const timingMap = new Map<string, number>();
  allDeals.forEach(d => { if (d.timing) timingMap.set(d.timing, (timingMap.get(d.timing) || 0) + 1); });
  const timings = [...timingMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxTiming = Math.max(...timings.map(t => t[1]), 1);

  // Dead deal reasons
  const archiveReasonMap = new Map<string, number>();
  deadDeals.forEach(d => {
    const reason = d.archive_reason?.trim() || 'Unknown';
    archiveReasonMap.set(reason, (archiveReasonMap.get(reason) || 0) + 1);
  });
  const archiveReasons = [...archiveReasonMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Pipeline funnel
  const funnelStages = [
    { label: 'Expected', count: expectedDeals.length, color: 'bg-secondary' },
    { label: 'Active', count: activeDeals.length, color: 'bg-accent' },
    { label: 'Dead', count: deadDeals.length, color: 'bg-danger' },
  ];
  const maxFunnel = Math.max(...funnelStages.map(s => s.count), 1);

  // Deal aging — how long deals have been in the pipeline
  const now = Date.now();
  const agingBuckets = [
    { label: '< 7 days', min: 0, max: 7, count: 0 },
    { label: '1-2 weeks', min: 7, max: 14, count: 0 },
    { label: '2-4 weeks', min: 14, max: 28, count: 0 },
    { label: '1-2 months', min: 28, max: 60, count: 0 },
    { label: '2-3 months', min: 60, max: 90, count: 0 },
    { label: '3+ months', min: 90, max: 9999, count: 0 },
  ];
  allDeals.forEach(d => {
    const days = d.created_at ? Math.floor((now - new Date(d.created_at).getTime()) / 86400000) : 0;
    const bucket = agingBuckets.find(b => days >= b.min && days < b.max);
    if (bucket) bucket.count++;
  });
  const maxAging = Math.max(...agingBuckets.map(b => b.count), 1);

  return (
    <div className="px-4 lg:px-8 pt-4 pb-8 space-y-4">
      <h1 className="text-xl font-bold">Stats</h1>

      {/* Weekly digest link */}
      <a href="/digest" className="block bg-secondary/10 border border-secondary/20 rounded-xl p-4 active:opacity-70">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary-dim flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-sm text-text-primary">Weekly Digest</h3>
            <p className="text-xs text-text-muted">What happened this week + stale deals</p>
          </div>
        </div>
      </a>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        <StatCard label="Active Deals" value={String(activeDeals.length)} accent="text-accent" />
        <StatCard label="Expected Deals" value={String(expectedDeals.length)} accent="text-secondary" />
        <StatCard label="Active EBITDA" value={`~${activeEbitda}m`} accent="text-accent" />
        <StatCard label="Expected EBITDA" value={`~${expectedEbitda}m`} accent="text-secondary" />
        <StatCard label="Dead Deals" value={String(deadDeals.length)} accent="text-danger" />
        <StatCard label="Total EBITDA" value={`~${activeEbitda + expectedEbitda}m`} accent="text-text-primary" />
      </div>

      {/* Pipeline funnel */}
      <div className="bg-bg-surface rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold mb-3">Pipeline Funnel</h2>
        <div className="space-y-2">
          {funnelStages.map(stage => (
            <div key={stage.label} className="flex items-center gap-3">
              <span className="text-xs text-text-secondary w-20 shrink-0">{stage.label}</span>
              <div className="flex-1 h-8 bg-bg-elevated rounded overflow-hidden relative">
                <div className={`h-full ${stage.color} rounded flex items-center justify-end pr-2`} style={{ width: `${Math.max((stage.count / maxFunnel) * 100, 8)}%` }}>
                  <span className="text-xs font-bold text-white font-mono">{stage.count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {expectedDeals.length > 0 && (
          <p className="text-[10px] text-text-muted mt-3 font-mono">
            Conversion: {Math.round((activeDeals.length / (activeDeals.length + expectedDeals.length)) * 100)}% of live deals are active
          </p>
        )}
      </div>

      {/* Deal aging */}
      <div className="bg-bg-surface rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold mb-3">Deal Aging</h2>
        <div className="space-y-2">
          {agingBuckets.filter(b => b.count > 0).map(bucket => (
            <div key={bucket.label} className="flex items-center gap-3">
              <span className="text-xs text-text-secondary w-24 shrink-0">{bucket.label}</span>
              <div className="flex-1 h-5 bg-bg-elevated rounded overflow-hidden">
                <div className={`h-full rounded ${bucket.min >= 28 ? 'bg-warning' : bucket.min >= 14 ? 'bg-warning/60' : 'bg-accent'}`} style={{ width: `${(bucket.count / maxAging) * 100}%` }} />
              </div>
              <span className="text-xs font-mono text-text-muted w-4 text-right shrink-0">{bucket.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Owner distribution */}
      {owners.length > 0 && (
        <ChartSection title="By Owner" entries={owners} maxVal={maxOwner} color="bg-secondary" />
      )}

      {/* Industry breakdown */}
      {industries.length > 0 && (
        <ChartSection title="By Industry" entries={industries} maxVal={maxIndustry} color="bg-accent" />
      )}

      {/* Timing distribution */}
      {timings.length > 0 && (
        <ChartSection title="By Timing" entries={timings} maxVal={maxTiming} color="bg-accent" />
      )}

      {/* Strategy mix */}
      {strategies.length > 0 && (
        <ChartSection title="Strategy Mix" entries={strategies} maxVal={maxStrategy} color="bg-accent" />
      )}

      {/* Top sponsors */}
      {topSponsors.length > 0 && (
        <ChartSection title="Top Sponsors (Interested)" entries={topSponsors} maxVal={maxSponsor} color="bg-secondary" />
      )}

      {/* Top advisors */}
      {topAdvisors.length > 0 && (
        <div className="bg-bg-surface rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-3">Top Advisors</h2>
          <div className="flex flex-wrap gap-2">
            {topAdvisors.map(([name, count]) => (
              <span key={name} className="text-xs px-2.5 py-1 rounded-full bg-bg-elevated text-text-secondary border border-border">
                {name} <span className="font-mono text-text-muted">({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dead deal reasons */}
      {archiveReasons.length > 0 && (
        <div className="bg-bg-surface rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-3">Top Archive Reasons</h2>
          <div className="space-y-2">
            {archiveReasons.map(([reason, count]) => (
              <div key={reason} className="flex items-center gap-3">
                <span className="text-xs text-text-secondary flex-1 break-words">{reason}</span>
                <span className="text-xs font-mono text-text-muted w-4 text-right shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {activity.length > 0 && (
        <div className="bg-bg-surface rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {activity.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-1.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${item.upload_type === 'pipeline' ? 'bg-accent' : 'bg-secondary'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-primary truncate">
                    {item.upload_type === 'pipeline' ? 'Pipeline sync' : item.upload_type === 'meeting_notes' ? 'Meeting notes' : item.upload_type}
                    {item.meeting_context && `: ${item.meeting_context}`}
                  </p>
                </div>
                <span className="text-[10px] text-text-muted font-mono shrink-0">
                  {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export link */}
      <a href="/export" className="block w-full bg-bg-surface rounded-xl border border-border p-4 text-center active:opacity-70">
        <div className="flex items-center justify-center gap-2">
          <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <span className="text-sm font-semibold text-text-primary">Export to CSV</span>
        </div>
      </a>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-bg-surface rounded-xl border border-border p-3.5">
      <p className="text-[10px] font-mono uppercase text-text-muted mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${accent}`}>{value}</p>
    </div>
  );
}

function ChartSection({ title, entries, maxVal, color }: { title: string; entries: [string, number][]; maxVal: number; color: string }) {
  return (
    <div className="bg-bg-surface rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      <div className="space-y-2">
        {entries.map(([name, count]) => (
          <div key={name} className="flex items-center gap-3">
            <span className="text-xs text-text-secondary truncate w-24 shrink-0">{name}</span>
            <div className="flex-1 h-5 bg-bg-elevated rounded overflow-hidden">
              <div className={`h-full ${color} rounded`} style={{ width: `${(count / maxVal) * 100}%` }} />
            </div>
            <span className="text-xs font-mono text-text-muted w-4 text-right shrink-0">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
