'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ActiveDeal, ExpectedDeal, MeetingNote } from '@/lib/types';

interface TimelineEvent {
  date: string;
  type: 'created' | 'note' | 'updated';
  title: string;
  detail?: string;
  changes?: Record<string, { old_hint?: string; new_value: string; reason?: string }>;
}

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [deal, setDeal] = useState<(ActiveDeal | ExpectedDeal) | null>(null);
  const [table, setTable] = useState<string>('');
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeal = async () => {
      // Try active_deals first, then expected_deals
      for (const t of ['active_deals', 'expected_deals']) {
        const res = await fetch(`/api/deals?table=${t}`);
        const deals = await res.json();
        if (Array.isArray(deals)) {
          const found = deals.find((d: { id: string }) => d.id === id);
          if (found) {
            setDeal(found);
            setTable(t);
            break;
          }
        }
      }

      // Fetch notes
      const notesRes = await fetch(`/api/deals/${id}/notes`);
      const notesData = await notesRes.json();
      setNotes(Array.isArray(notesData) ? notesData : []);

      setLoading(false);
    };
    fetchDeal();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="px-4 lg:px-8 pt-5 text-center py-24">
        <p className="text-text-muted text-sm">Deal not found.</p>
        <button onClick={() => router.push('/')} className="text-accent text-sm mt-2">← Back to Pipeline</button>
      </div>
    );
  }

  const isActive = table === 'active_deals';
  const strategy = isActive ? (deal as ActiveDeal).strategy : (deal as ExpectedDeal).expected_strategy;
  const statusOrComment = isActive ? (deal as ActiveDeal).status : (deal as ExpectedDeal).comment;

  // Build timeline
  const timeline: TimelineEvent[] = [];

  // Created event
  if (deal.created_at) {
    timeline.push({
      date: deal.created_at,
      type: 'created',
      title: `Added to ${isActive ? 'Active' : 'Expected'} pipeline`,
    });
  }

  // Meeting notes
  for (const note of notes) {
    const parsed = note.parsed_updates as { meeting_summary?: string; updates?: Array<{ company: string; changes?: Record<string, { old_hint?: string; new_value: string; reason?: string }> }> } | undefined;
    const relevantUpdate = parsed?.updates?.find(
      (u: { company: string }) => u.company?.toLowerCase() === deal.company?.toLowerCase()
    );
    timeline.push({
      date: note.created_at,
      type: 'note',
      title: note.meeting_with ? `Meeting with ${note.meeting_with}` : 'Meeting notes',
      detail: parsed?.meeting_summary || '',
      changes: relevantUpdate?.changes,
    });
  }

  // Last updated (if different from created)
  if (deal.updated_at && deal.created_at && deal.updated_at !== deal.created_at) {
    // Only show if no note matches this timestamp
    const hasNoteAtTime = notes.some(n => n.created_at === deal.updated_at);
    if (!hasNoteAtTime) {
      timeline.push({
        date: deal.updated_at,
        type: 'updated',
        title: 'Deal updated',
      });
    }
  }

  // Sort timeline by date
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const fields = [
    { label: 'Project', value: deal.project },
    { label: 'Industry', value: deal.industry },
    { label: 'Owner', value: deal.owner },
    { label: 'EBITDA', value: deal.ebitda, mono: true },
    { label: isActive ? 'Status' : 'Comment', value: statusOrComment },
    { label: 'Timing', value: deal.timing },
    { label: 'Strategy', value: strategy },
    { label: 'Origination', value: deal.origination },
    { label: 'Advisors', value: deal.advisors },
  ];

  const interestedSponsors = deal.sponsors_interested?.split(',').map(s => s.trim()).filter(Boolean) || [];
  const declinedSponsors = deal.sponsors_declined?.split(',').map(s => s.trim()).filter(Boolean) || [];

  return (
    <div className="px-4 lg:px-8 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.push('/')} className="text-text-muted hover:text-text-primary shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${isActive ? 'text-accent bg-accent-dim' : 'text-secondary bg-secondary-dim'}`}>
              {isActive ? 'ACTIVE' : 'EXPECTED'}
            </span>
            {strategy && (
              <span className="text-[10px] font-mono font-semibold text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">{strategy}</span>
            )}
          </div>
          <h1 className="text-lg font-bold truncate">{deal.company}</h1>
        </div>
        {deal.ebitda && (
          <span className="font-mono font-bold text-accent text-lg shrink-0">{deal.ebitda}</span>
        )}
      </div>

      {/* Fields */}
      <div className="bg-bg-surface rounded-xl border border-border p-4 mb-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {fields.filter(f => f.value).map(f => (
            <div key={f.label} className={f.label === (isActive ? 'Status' : 'Comment') || f.label === 'Origination' ? 'col-span-2' : ''}>
              <span className="text-[10px] font-mono uppercase text-text-muted block">{f.label}</span>
              <p className={`text-sm text-text-primary break-words ${f.mono ? 'font-mono' : ''}`}>{f.value}</p>
            </div>
          ))}
        </div>

        {/* Sponsors */}
        {(interestedSponsors.length > 0 || declinedSponsors.length > 0) && (
          <div className="mt-4 pt-3 border-t border-border space-y-2.5">
            {interestedSponsors.length > 0 && (
              <div>
                <span className="text-[10px] font-mono uppercase text-text-muted block mb-1">Sponsors Interested</span>
                <div className="flex flex-wrap gap-1.5">
                  {interestedSponsors.map((s, i) => (
                    <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-accent/15 text-accent font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {declinedSponsors.length > 0 && (
              <div>
                <span className="text-[10px] font-mono uppercase text-text-muted block mb-1">Sponsors Declined</span>
                <div className="flex flex-wrap gap-1.5">
                  {declinedSponsors.map((s, i) => (
                    <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-danger/15 text-danger font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Timeline
        </h2>

        {timeline.length === 0 ? (
          <p className="text-xs text-text-muted py-4 text-center">No activity yet.</p>
        ) : (
          <div className="space-y-0">
            {timeline.map((event, i) => (
              <div key={i} className="flex gap-3">
                {/* Timeline line + dot */}
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                    event.type === 'created' ? 'bg-accent' :
                    event.type === 'note' ? 'bg-secondary' : 'bg-text-muted'
                  }`} />
                  {i < timeline.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                </div>

                {/* Content */}
                <div className="pb-4 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-mono text-text-muted">
                      {new Date(event.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-text-primary">{event.title}</p>
                  {event.detail && <p className="text-xs text-text-secondary mt-0.5 break-words">{event.detail}</p>}

                  {/* Changes from notes */}
                  {event.changes && Object.keys(event.changes).length > 0 && (
                    <div className="mt-2 bg-bg-elevated rounded-lg p-2.5 border border-border space-y-1">
                      {Object.entries(event.changes).map(([field, change]) => (
                        <div key={field}>
                          <span className="text-[10px] font-mono text-text-muted uppercase">{field}: </span>
                          {change.old_hint && <span className="text-[10px] text-danger/70 line-through mr-1">{change.old_hint}</span>}
                          <span className="text-[10px] text-accent font-medium">→ {change.new_value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
