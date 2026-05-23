'use client';

import { useState, useEffect, useCallback } from 'react';
import { MeetingNote } from '@/lib/types';

interface NoteWithDetails extends MeetingNote {
  parsed_updates: {
    meeting_summary?: string;
    updates?: Array<{
      company: string;
      match_type: string;
      changes?: Record<string, { old_hint?: string; new_value: string; reason?: string }>;
      new_deal_data?: Record<string, string>;
    }>;
  };
}

export default function NotesArchive() {
  const [notes, setNotes] = useState<NoteWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'person' | 'company'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Extract unique persons and companies for quick filters
  const uniquePersons = [...new Set(notes.map(n => n.meeting_with).filter(Boolean))];
  const uniqueCompanies = [...new Set(notes.map(n => n.deal_company).filter(Boolean))];

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter && filterType === 'person') params.set('person', filter);
    if (filter && filterType === 'company') params.set('company', filter);
    try {
      const res = await fetch(`/api/meeting-notes?${params}`);
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch {
      setNotes([]);
    }
    setLoading(false);
  }, [filter, filterType]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleQuickFilter = (type: 'person' | 'company', value: string) => {
    if (filter === value && filterType === type) {
      // Toggle off
      setFilter('');
      setFilterType('all');
    } else {
      setFilter(value);
      setFilterType(type);
    }
  };

  const clearFilter = () => {
    setFilter('');
    setFilterType('all');
  };

  return (
    <div className="px-4 lg:px-8 pt-5">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold">Meeting Notes</h1>
        <p className="text-xs text-text-muted font-mono mt-0.5">
          {notes.length} note{notes.length !== 1 ? 's' : ''}
          {filter && ` · filtered by ${filterType}: "${filter}"`}
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search by person or company..."
          value={filter}
          onChange={e => {
            setFilter(e.target.value);
            setFilterType('all');
          }}
          className="w-full bg-bg-surface border border-border rounded-xl pl-10 pr-10 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-secondary"
        />
        {filter && (
          <button onClick={clearFilter} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Quick filter chips — Persons */}
      {!filter && uniquePersons.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-mono uppercase text-text-muted mb-1.5">People / Sponsors</p>
          <div className="flex flex-wrap gap-1.5">
            {uniquePersons.map(person => (
              <button
                key={person}
                onClick={() => handleQuickFilter('person', person)}
                className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                  filter === person && filterType === 'person'
                    ? 'bg-secondary text-white'
                    : 'bg-secondary/15 text-secondary hover:bg-secondary/25'
                }`}
              >
                {person}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick filter chips — Companies */}
      {!filter && uniqueCompanies.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-mono uppercase text-text-muted mb-1.5">Companies</p>
          <div className="flex flex-wrap gap-1.5">
            {uniqueCompanies.map(company => (
              <button
                key={company}
                onClick={() => handleQuickFilter('company', company)}
                className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                  filter === company && filterType === 'company'
                    ? 'bg-accent text-white'
                    : 'bg-accent/15 text-accent hover:bg-accent/25'
                }`}
              >
                {company}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active filter bar */}
      {filter && (
        <div className="flex items-center gap-2 mb-4 bg-bg-surface rounded-lg px-3 py-2 border border-border">
          <span className="text-[10px] font-mono uppercase text-text-muted">Filtered:</span>
          <span className="text-xs text-text-primary font-medium">{filter}</span>
          <button onClick={clearFilter} className="ml-auto text-text-muted hover:text-text-primary">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Notes list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">
          {filter ? 'No notes match this filter.' : 'No meeting notes yet. Add some via the Update tab.'}
        </div>
      ) : (
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              expanded={expandedId === note.id}
              onToggle={() => setExpandedId(expandedId === note.id ? null : note.id)}
              onFilterPerson={(p) => handleQuickFilter('person', p)}
              onFilterCompany={(c) => handleQuickFilter('company', c)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteCard({
  note,
  expanded,
  onToggle,
  onFilterPerson,
  onFilterCompany,
}: {
  note: NoteWithDetails;
  expanded: boolean;
  onToggle: () => void;
  onFilterPerson: (p: string) => void;
  onFilterCompany: (c: string) => void;
}) {
  const date = new Date(note.created_at);
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const summary = note.parsed_updates?.meeting_summary || '';
  const updates = note.parsed_updates?.updates || [];
  const affectedCount = note.affected_deal_ids?.length || updates.length || 0;

  return (
    <div className="bg-bg-surface rounded-xl border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left p-4 active:bg-bg-elevated/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Date + badges */}
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span className="text-[10px] font-mono text-text-muted">{dateStr} · {timeStr}</span>
              {affectedCount > 0 && (
                <span className="text-[10px] font-mono font-semibold text-accent bg-accent-dim px-1.5 py-0.5 rounded">
                  {affectedCount} deal{affectedCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Meeting with */}
            {note.meeting_with && (
              <p className="text-sm font-semibold text-text-primary mb-0.5 truncate">
                {note.meeting_with}
              </p>
            )}

            {/* Company */}
            {note.deal_company && (
              <p className="text-xs text-secondary truncate">{note.deal_company}</p>
            )}

            {/* Summary */}
            {summary && !expanded && (
              <p className="text-xs text-text-secondary mt-1 line-clamp-2">{summary}</p>
            )}
          </div>

          <svg
            className={`w-4 h-4 text-text-muted shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {/* Summary */}
          {summary && (
            <div className="bg-secondary/10 rounded-lg px-3 py-2.5 border border-secondary/20">
              <p className="text-xs text-text-primary leading-relaxed">{summary}</p>
            </div>
          )}

          {/* Clickable chips */}
          <div className="flex flex-wrap gap-1.5">
            {note.meeting_with && (
              <button
                onClick={() => onFilterPerson(note.meeting_with)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-medium hover:bg-secondary/25"
              >
                👤 {note.meeting_with}
              </button>
            )}
            {note.deal_company && (
              <button
                onClick={() => onFilterCompany(note.deal_company)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium hover:bg-accent/25"
              >
                🏢 {note.deal_company}
              </button>
            )}
          </div>

          {/* Changes per deal */}
          {updates.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase text-text-muted">Changes Applied</p>
              {updates.map((update, i) => (
                <div key={i} className="bg-bg-elevated rounded-lg px-3 py-2.5 border border-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      update.match_type === 'new_deal'
                        ? 'bg-accent/15 text-accent'
                        : 'bg-warning/15 text-warning'
                    }`}>
                      {update.match_type === 'new_deal' ? 'NEW' : 'UPDATED'}
                    </span>
                    <span className="text-xs font-semibold text-text-primary">{update.company}</span>
                  </div>

                  {update.changes && Object.entries(update.changes).map(([field, change]) => (
                    <div key={field} className="mt-1.5">
                      <span className="text-[10px] font-mono text-text-muted uppercase">{field}: </span>
                      {change.old_hint && (
                        <span className="text-[10px] text-danger/80 line-through mr-1">{change.old_hint}</span>
                      )}
                      <span className="text-[10px] text-accent font-medium">→ {change.new_value}</span>
                      {change.reason && (
                        <p className="text-[10px] text-text-muted mt-0.5 italic">{change.reason}</p>
                      )}
                    </div>
                  ))}

                  {update.new_deal_data && (
                    <div className="mt-1 space-y-0.5">
                      {Object.entries(update.new_deal_data).filter(([, v]) => v).map(([k, v]) => (
                        <p key={k} className="text-[10px] text-text-secondary">
                          <span className="font-mono text-text-muted uppercase">{k}:</span> {v}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Raw content */}
          {note.raw_content && note.raw_content !== '(Photo upload)' && (
            <details className="group">
              <summary className="text-[10px] font-mono uppercase text-text-muted cursor-pointer hover:text-text-secondary">
                Raw Notes ▸
              </summary>
              <pre className="mt-2 text-xs text-text-secondary bg-bg-elevated rounded-lg p-3 border border-border whitespace-pre-wrap break-words font-mono leading-relaxed max-h-48 overflow-y-auto">
                {note.raw_content}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
