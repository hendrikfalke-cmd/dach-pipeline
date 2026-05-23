'use client';

import { DealDiff } from '@/lib/types';

interface DiffViewProps {
  diffs: DealDiff[];
  onToggle: (index: number) => void;
}

const statusConfig = {
  new: { label: 'NEW', color: 'bg-accent/15 text-accent border-accent/30' },
  changed: { label: 'CHANGED', color: 'bg-warning/15 text-warning border-warning/30' },
  removed: { label: 'REMOVED', color: 'bg-danger/15 text-danger border-danger/30' },
  unchanged: { label: 'UNCHANGED', color: 'bg-bg-elevated text-text-muted border-border' },
};

export default function DiffView({ diffs, onToggle }: DiffViewProps) {
  const sorted = [...diffs].sort((a, b) => {
    const order = { new: 0, changed: 1, removed: 2, unchanged: 3 };
    return order[a.status] - order[b.status];
  });

  const counts = {
    new: diffs.filter(d => d.status === 'new').length,
    changed: diffs.filter(d => d.status === 'changed').length,
    removed: diffs.filter(d => d.status === 'removed').length,
    unchanged: diffs.filter(d => d.status === 'unchanged').length,
  };

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex gap-2 flex-wrap">
        {counts.new > 0 && <Badge label={`${counts.new} new`} color="bg-accent/15 text-accent" />}
        {counts.changed > 0 && <Badge label={`${counts.changed} changed`} color="bg-warning/15 text-warning" />}
        {counts.removed > 0 && <Badge label={`${counts.removed} removed`} color="bg-danger/15 text-danger" />}
        {counts.unchanged > 0 && <Badge label={`${counts.unchanged} unchanged`} color="bg-bg-elevated text-text-muted" />}
      </div>

      {/* Diff cards */}
      {sorted.map((diff, i) => {
        const originalIndex = diffs.indexOf(diff);
        const config = statusConfig[diff.status];
        return (
          <div
            key={`${diff.company}-${i}`}
            className={`rounded-xl border p-3.5 ${config.color}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase">{config.label}</span>
                <h3 className="font-semibold text-text-primary text-sm">{diff.company}</h3>
                <span className="text-[10px] text-text-muted font-mono">
                  {diff.table === 'active_deals' ? 'Active' : 'Expected'}
                </span>
              </div>
              {diff.status !== 'unchanged' && (
                <button
                  onClick={() => onToggle(originalIndex)}
                  className={`w-6 h-6 rounded-md border flex items-center justify-center ${
                    diff.selected
                      ? 'bg-accent border-accent'
                      : 'border-border-light bg-bg-elevated'
                  }`}
                >
                  {diff.selected && (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              )}
            </div>

            {/* Field changes */}
            {diff.changes && diff.changes.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {diff.changes.map((change, ci) => (
                  <div key={ci} className="text-xs">
                    <span className="font-mono text-text-muted uppercase text-[10px]">{change.field}: </span>
                    <span className="text-danger/80 line-through">{change.oldValue || '(empty)'}</span>
                    <span className="text-text-muted mx-1">&rarr;</span>
                    <span className="text-accent">{change.newValue}</span>
                  </div>
                ))}
              </div>
            )}

            {/* New deal preview */}
            {diff.status === 'new' && diff.parsedDeal && (
              <div className="space-y-1 mt-2">
                {Object.entries(diff.parsedDeal).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="text-xs">
                    <span className="font-mono text-text-muted uppercase text-[10px]">{k}: </span>
                    <span className="text-text-secondary">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`text-[10px] font-mono font-semibold px-2 py-1 rounded-full ${color}`}>
      {label}
    </span>
  );
}
