'use client';

import { MeetingNote } from '@/lib/types';

interface Props {
  notes: MeetingNote[];
}

export default function DealNotesHistory({ notes }: Props) {
  if (notes.length === 0) {
    return (
      <div className="text-xs text-text-muted text-center py-3">
        No meeting notes for this deal yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notes.map((note) => (
        <div key={note.id} className="bg-bg-elevated rounded-lg p-2.5 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-secondary">
              {new Date(note.meeting_date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            {note.meeting_with && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary-dim text-secondary">
                {note.meeting_with}
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
            {note.raw_content}
          </p>
        </div>
      ))}
    </div>
  );
}
