'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ActiveDeal, ExpectedDeal, DealTable, MeetingNote } from '@/lib/types';
import DealNotesHistory from './DealNotesHistory';

const STALE_DAYS = 14;
const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  hot:  { bg: 'bg-danger/15', text: 'text-danger', label: 'HOT' },
  warm: { bg: 'bg-warning/15', text: 'text-warning', label: 'WARM' },
  cold: { bg: 'bg-blue-400/15', text: 'text-blue-400', label: 'COLD' },
};

interface DealCardProps {
  deal: ActiveDeal | ExpectedDeal;
  table: DealTable;
  onEdit: (deal: ActiveDeal | ExpectedDeal, table: DealTable) => void;
  onArchive: (deal: ActiveDeal | ExpectedDeal, table: DealTable) => void;
  onMove: (deal: ActiveDeal | ExpectedDeal, fromTable: DealTable) => void;
  onQuickNote: (deal: ActiveDeal | ExpectedDeal, table: DealTable) => void;
  onPriorityChange: (deal: ActiveDeal | ExpectedDeal, table: DealTable, priority: string) => void;
  onFieldUpdate?: (id: string, table: DealTable, field: string, value: string) => void;
}

function SponsorChips({ label, value, color }: { label: string; value: string; color: string }) {
  if (!value) return null;
  const sponsors = value.split(',').map(s => s.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-[10px] text-text-muted font-mono uppercase shrink-0">{label}:</span>
      {sponsors.slice(0, 4).map((s, i) => (
        <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full ${color} font-medium whitespace-nowrap`}>{s}</span>
      ))}
      {sponsors.length > 4 && <span className="text-[10px] text-text-muted">+{sponsors.length - 4}</span>}
    </div>
  );
}

function getDaysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function DealCard({ deal, table, onEdit, onArchive, onMove, onQuickNote, onPriorityChange, onFieldUpdate }: DealCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const isActive = table === 'active_deals';
  const strategy = isActive ? (deal as ActiveDeal).strategy : (deal as ExpectedDeal).expected_strategy;
  const statusOrComment = isActive ? (deal as ActiveDeal).status : (deal as ExpectedDeal).comment;
  const priority = deal.priority || 'warm';
  const priorityStyle = PRIORITY_COLORS[priority] || PRIORITY_COLORS.warm;

  const daysAgo = deal.updated_at ? getDaysAgo(deal.updated_at) : 999;
  const isStale = daysAgo >= STALE_DAYS;

  const loadNotes = async () => {
    if (notes.length > 0 || loadingNotes) { setShowNotes(!showNotes); return; }
    setLoadingNotes(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}/notes`);
      const data = await res.json();
      setNotes(data);
      setShowNotes(true);
    } catch { /* silently fail */ }
    setLoadingNotes(false);
  };

  const updatedAgo = deal.updated_at ? formatTimeAgo(new Date(deal.updated_at)) : '';

  const handleFieldSave = (field: string, value: string) => {
    if (onFieldUpdate) {
      onFieldUpdate(deal.id, table, field, value);
    }
  };

  // Build editable fields list
  const fields: { key: string; label: string; value: string; multiline?: boolean }[] = [
    { key: 'owner', label: 'Owner', value: deal.owner || '' },
    { key: 'timing', label: 'Timing', value: deal.timing || '' },
    { key: isActive ? 'status' : 'comment', label: isActive ? 'Status' : 'Comment', value: statusOrComment || '', multiline: true },
    { key: 'origination', label: 'Origination', value: deal.origination || '', multiline: true },
    { key: 'advisors', label: 'Advisors', value: deal.advisors || '' },
    { key: 'sponsors_interested', label: 'Interested', value: deal.sponsors_interested || '' },
    { key: 'sponsors_declined', label: 'Declined', value: deal.sponsors_declined || '' },
  ];

  return (
    <div className={`bg-bg-surface rounded-xl border overflow-hidden ${isStale ? 'border-danger/40' : 'border-border'}`}>
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-start gap-3 active:bg-bg-elevated/50"
      >
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${priorityStyle.bg} ${priorityStyle.text}`}>
              {priorityStyle.label}
            </span>
            {deal.project && (
              <span className="text-[10px] font-mono font-semibold text-secondary bg-secondary-dim px-1.5 py-0.5 rounded whitespace-nowrap">{deal.project}</span>
            )}
            {strategy && (
              <span className="text-[10px] font-mono font-semibold text-accent bg-accent-dim px-1.5 py-0.5 rounded whitespace-nowrap">{strategy}</span>
            )}
            {isStale && (
              <span className="text-[10px] font-mono font-bold text-danger bg-danger/15 px-1.5 py-0.5 rounded whitespace-nowrap">
                STALE {daysAgo}d
              </span>
            )}
          </div>
          <Link href={`/deals/${deal.id}`} onClick={e => e.stopPropagation()} className="font-semibold text-text-primary truncate text-[15px] block hover:text-accent active:text-accent">
            {deal.company}
          </Link>
          {deal.industry && <p className="text-xs text-text-secondary truncate mt-0.5">{deal.industry}</p>}
        </div>
        <div className="text-right shrink-0 ml-2">
          {deal.ebitda && <span className="font-mono font-semibold text-accent text-sm">{deal.ebitda}</span>}
          <div className={`text-[10px] mt-0.5 ${isStale ? 'text-danger font-semibold' : 'text-text-muted'}`}>{updatedAgo}</div>
          <svg className={`w-4 h-4 text-text-muted mt-1 ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {/* Priority selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-text-muted shrink-0">Priority:</span>
            {(['hot', 'warm', 'cold'] as const).map(p => {
              const ps = PRIORITY_COLORS[p];
              return (
                <button
                  key={p}
                  onClick={() => onPriorityChange(deal, table, p)}
                  className={`text-[10px] font-mono font-bold px-2 py-1 rounded-lg transition-colors ${
                    priority === p ? `${ps.bg} ${ps.text} ring-1 ring-current` : 'bg-bg-elevated text-text-muted'
                  }`}
                >
                  {ps.label}
                </button>
              );
            })}
          </div>

          {/* Inline-editable fields */}
          <div className="space-y-2">
            {fields.map(f => (
              <EditableField
                key={f.key}
                label={f.label}
                value={f.value}
                multiline={f.multiline}
                onSave={(val) => handleFieldSave(f.key, val)}
              />
            ))}
          </div>

          {/* Notes link + Quick note */}
          <div className="border-t border-border pt-3 flex items-center gap-3">
            <button onClick={loadNotes} className="text-xs font-medium text-secondary hover:text-secondary/80 flex items-center gap-1.5 py-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              {loadingNotes ? 'Loading...' : `Notes${notes.length > 0 ? ` (${notes.length})` : ''}`}
            </button>
            <button
              onClick={() => onQuickNote(deal, table)}
              className="text-xs font-medium text-accent hover:text-accent/80 flex items-center gap-1.5 py-1 ml-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Quick note
            </button>
          </div>

          {showNotes && <DealNotesHistory notes={notes} />}

          {/* Actions */}
          <div className="flex gap-2 border-t border-border pt-3">
            <button onClick={() => onEdit(deal, table)} className="flex-1 text-sm font-medium text-center py-2.5 rounded-xl bg-bg-elevated hover:bg-bg-hover text-text-primary active:opacity-70">All Fields</button>
            <button onClick={() => onMove(deal, table)} className="flex-1 text-sm font-medium text-center py-2.5 rounded-xl bg-secondary-dim hover:bg-secondary/20 text-secondary active:opacity-70">
              → {isActive ? 'Expected' : 'Active'}
            </button>
            <button onClick={() => onArchive(deal, table)} className="text-sm font-medium text-center py-2.5 px-3 rounded-xl bg-warning/10 hover:bg-warning/20 text-warning active:opacity-70">Archive</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Inline editable field — tap to edit, blur or Enter to save */
function EditableField({ label, value, multiline, onSave }: {
  label: string;
  value: string;
  multiline?: boolean;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const handleSave = () => {
    setEditing(false);
    if (draft.trim() !== value.trim()) {
      onSave(draft.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setDraft(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div>
        <span className="text-[10px] font-mono uppercase text-text-muted">{label}</span>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full bg-bg-elevated border border-accent rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none resize-none mt-1"
            rows={3}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full bg-bg-elevated border border-accent rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none mt-1"
          />
        )}
      </div>
    );
  }

  // Display mode — tap to edit
  if (!value) {
    return (
      <button onClick={() => setEditing(true)} className="w-full text-left group">
        <span className="text-[10px] font-mono uppercase text-text-muted">{label}</span>
        <p className="text-xs text-text-muted italic group-hover:text-accent mt-0.5">Tap to add...</p>
      </button>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="w-full text-left group overflow-hidden">
      <span className="text-[10px] font-mono uppercase text-text-muted">{label}
        <span className="opacity-0 group-hover:opacity-100 text-accent ml-1 transition-opacity">✎</span>
      </span>
      <p className="text-xs text-text-secondary leading-relaxed break-words group-hover:text-text-primary transition-colors">{value}</p>
    </button>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
