'use client';

import { NoteUpdate } from '@/lib/types';

interface NotesDiffViewProps {
  updates: NoteUpdate[];
  meetingSummary?: string;
  meetingWith?: string;
  onToggle: (index: number) => void;
}

export default function NotesDiffView({ updates, meetingSummary, meetingWith, onToggle }: NotesDiffViewProps) {
  return (
    <div className="space-y-3">
      {/* Meeting summary */}
      {meetingSummary && (
        <div className="bg-secondary-dim rounded-xl p-3.5 border border-secondary/20">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span className="text-xs font-semibold text-secondary">Meeting Notes</span>
            {meetingWith && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/20 text-secondary">
                {meetingWith}
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary">{meetingSummary}</p>
        </div>
      )}

      {/* Update cards */}
      {updates.map((update, i) => {
        const matchType = (update as NoteUpdate & { match_type: string }).match_type;
        const isNew = matchType === 'new_deal';
        const isUnmatched = matchType === 'unmatched_existing';

        return (
          <div
            key={`${update.company}-${i}`}
            className={`rounded-xl border p-3.5 ${
              isNew
                ? 'bg-accent/10 border-accent/30'
                : isUnmatched
                  ? 'bg-warning/10 border-warning/30'
                  : 'bg-bg-surface border-border'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  {isNew ? (
                    <span className="text-[10px] font-mono font-bold text-accent uppercase">NEW DEAL</span>
                  ) : isUnmatched ? (
                    <span className="text-[10px] font-mono font-bold text-warning uppercase">NOT FOUND — ADD AS NEW?</span>
                  ) : (
                    <span className="text-[10px] font-mono text-text-muted uppercase">
                      {update.deal_table === 'active_deals' ? 'Active' : 'Expected'}
                    </span>
                  )}
                  {update.confidence !== 'high' && !isUnmatched && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      update.confidence === 'low'
                        ? 'bg-danger/15 text-danger'
                        : 'bg-warning/15 text-warning'
                    }`}>
                      {update.confidence} confidence
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-text-primary text-sm">{update.company}</h3>
                {isUnmatched && (
                  <p className="text-[10px] text-warning mt-0.5">
                    This company wasn&apos;t found in your pipeline. Toggle to add it as a new Expected deal.
                  </p>
                )}
              </div>
              <button
                onClick={() => onToggle(i)}
                className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ml-2 ${
                  update.selected
                    ? isUnmatched ? 'bg-warning border-warning' : 'bg-accent border-accent'
                    : 'border-border-light bg-bg-elevated'
                }`}
              >
                {update.selected && (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            </div>

            {/* Existing deal changes */}
            {update.changes && Object.keys(update.changes).length > 0 && !isUnmatched && (
              <div className="space-y-2 mt-2">
                {Object.entries(update.changes).map(([field, change]) => (
                  <div key={field} className="text-xs">
                    <span className="font-mono text-text-muted uppercase text-[10px]">{field}: </span>
                    {change.old_hint && (
                      <>
                        <span className="text-danger/80 line-through">{change.old_hint}</span>
                        <span className="text-text-muted mx-1">&rarr;</span>
                      </>
                    )}
                    <span className="text-accent">{change.new_value}</span>
                    {change.reason && (
                      <p className="text-[10px] text-text-muted mt-0.5 italic">{change.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* New deal data (for new_deal and unmatched_existing) */}
            {(isNew || isUnmatched) && update.new_deal_data && (
              <div className="space-y-1 mt-2">
                {Object.entries(update.new_deal_data).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="text-xs">
                    <span className="font-mono text-text-muted uppercase text-[10px]">{k}: </span>
                    <span className="text-text-secondary">{String(v)}</span>
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
