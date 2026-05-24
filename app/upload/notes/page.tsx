'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from '@/components/ImageUpload';
import NotesDiffView from '@/components/NotesDiffView';
import Toast from '@/components/Toast';
import { NoteUpdate, ParsedNotesResponse } from '@/lib/types';

type Stage = 'input' | 'processing' | 'review' | 'applying';
type InputMode = 'text' | 'photo';

export default function NotesUpload() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('input');
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [notesText, setNotesText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [context, setContext] = useState('');
  const [parsedResponse, setParsedResponse] = useState<ParsedNotesResponse | null>(null);
  const [updates, setUpdates] = useState<NoteUpdate[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canProcess = inputMode === 'text' ? notesText.trim().length > 0 : imageFile !== null;

  const handleProcess = async () => {
    setStage('processing');
    setError(null);

    try {
      const formData = new FormData();
      if (inputMode === 'text') {
        formData.append('text', notesText);
      } else if (imageFile) {
        formData.append('image', imageFile);
      }
      if (context) formData.append('context', context);

      const res = await fetch('/api/parse-notes', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to parse notes');
      }

      const parsed: ParsedNotesResponse = await res.json();
      setParsedResponse(parsed);
      setUpdates((parsed.updates || []).map(u => ({ ...u, selected: true })));
      setStage('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStage('input');
    }
  };

  const handleToggle = (index: number) => {
    setUpdates(prev => prev.map((u, i) => i === index ? { ...u, selected: !u.selected } : u));
  };

  const handleApply = async () => {
    setStage('applying');
    const selected = updates.filter(u => u.selected);
    let updatedCount = 0, addedCount = 0;
    const affectedDealIds: string[] = [];

    try {
      for (const update of selected) {
        if (update.match_type === 'existing' && update.changes) {
          let existingDeal = (update as NoteUpdate & { existing_deal?: { id: string } }).existing_deal;

          // Fallback: if existing_deal wasn't matched by API, search by company name now
          if (!existingDeal && update.company) {
            const searchRes = await fetch(`/api/deals?table=${update.deal_table}&search=${encodeURIComponent(update.company)}`);
            const searchResults = await searchRes.json();
            if (Array.isArray(searchResults) && searchResults.length > 0) {
              // Find best match
              const companyLower = update.company.toLowerCase().trim();
              existingDeal = searchResults.find(
                (d: { company: string }) => d.company.toLowerCase().trim() === companyLower
              ) || searchResults.find(
                (d: { company: string }) =>
                  d.company.toLowerCase().includes(companyLower) ||
                  companyLower.includes(d.company.toLowerCase().trim())
              ) || searchResults[0]; // last resort: first result
            }
          }

          if (existingDeal) {
            const changeValues: Record<string, string> = {};
            Object.entries(update.changes).forEach(([field, change]) => {
              changeValues[field] = change.new_value;
            });
            await fetch('/api/deals', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: existingDeal.id, table: update.deal_table, ...changeValues }),
            });
            affectedDealIds.push(existingDeal.id);
            updatedCount++;
          }
        } else if ((update.match_type === 'new_deal' || (update as NoteUpdate & { match_type: string }).match_type === 'unmatched_existing') && update.new_deal_data) {
          const res = await fetch('/api/deals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...update.new_deal_data, table: update.deal_table }),
          });
          if (res.ok) {
            const newDeal = await res.json();
            affectedDealIds.push(newDeal.id);
            addedCount++;
          }
        }
      }

      // Store the meeting note with full detail
      const noteRes = await fetch('/api/meeting-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_content: notesText || '(Photo upload)',
          parsed_updates: parsedResponse,
          affected_deal_ids: affectedDealIds,
          meeting_with: parsedResponse?.meeting_with || '',
          meeting_context: context || '',
          deal_companies: selected.map(u => u.company),
          source_type: inputMode === 'photo' ? 'image' : 'text',
          deals_added: addedCount,
          deals_updated: updatedCount,
        }),
      }).catch(() => null);

      const noteMeta = noteRes ? await noteRes.json().catch(() => null) : null;
      const crmMsg = noteMeta?.crm_logged ? ` · logged to CRM (${noteMeta.crm_institution})` : '';

      setToast({
        message: `Applied: ${updatedCount} updated, ${addedCount} added${crmMsg}`,
        type: 'success',
      });
      setTimeout(() => router.push('/'), 2000);
    } catch {
      setToast({ message: 'Failed to apply some changes', type: 'error' });
      setStage('review');
    }
  };

  const selectedCount = updates.filter(u => u.selected).length;

  return (
    <div className="px-4 lg:px-8 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="text-text-muted hover:text-text-primary">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-bold">Meeting Notes</h1>
          <p className="text-[10px] text-text-muted font-mono">Photo or text — AI maps to your deals</p>
        </div>
      </div>

      {stage === 'input' && (
        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setInputMode('photo')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border ${
                inputMode === 'photo'
                  ? 'border-secondary bg-secondary-dim text-secondary'
                  : 'border-border text-text-muted'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              Photo
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border ${
                inputMode === 'text'
                  ? 'border-secondary bg-secondary-dim text-secondary'
                  : 'border-border text-text-muted'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              Text
            </button>
          </div>

          {/* Context field */}
          <div>
            <label className="text-[10px] font-mono uppercase text-text-muted mb-1 block">
              Context (optional)
            </label>
            <input
              type="text"
              placeholder='e.g. "Call with Ardian re: DuSoil labs"'
              value={context}
              onChange={e => setContext(e.target.value)}
              className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-secondary"
            />
          </div>

          {/* Input area */}
          {inputMode === 'photo' ? (
            <ImageUpload
              onImageSelected={(file) => setImageFile(file)}
              label="Photo of handwritten or printed notes"
            />
          ) : (
            <div>
              <label className="text-[10px] font-mono uppercase text-text-muted mb-1 block">
                Notes
              </label>
              <textarea
                value={notesText}
                onChange={e => setNotesText(e.target.value)}
                placeholder="Paste your meeting notes here..."
                className="w-full bg-bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-secondary resize-none min-h-[200px]"
                rows={10}
              />
            </div>
          )}

          {error && (
            <div className="text-xs text-danger bg-danger/10 rounded-lg p-3 border border-danger/20">
              {error}
            </div>
          )}

          <button
            onClick={handleProcess}
            disabled={!canProcess}
            className="w-full py-3 rounded-xl bg-secondary text-white font-semibold text-sm disabled:opacity-50"
          >
            Process Notes
          </button>
        </div>
      )}

      {stage === 'processing' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-10 h-10 border-3 border-secondary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-secondary">Analyzing meeting notes...</p>
          <p className="text-[10px] text-text-muted">Matching updates to your pipeline deals</p>
        </div>
      )}

      {stage === 'review' && parsedResponse && (
        <div className="space-y-4">
          <NotesDiffView
            updates={updates}
            meetingSummary={parsedResponse.meeting_summary}
            meetingWith={parsedResponse.meeting_with}
            onToggle={handleToggle}
          />

          {parsedResponse.unmatched_mentions && parsedResponse.unmatched_mentions.length > 0 && (
            <div className="bg-warning/10 rounded-lg p-3 border border-warning/20">
              <p className="text-[10px] font-mono text-warning uppercase mb-1">Unmatched References</p>
              <p className="text-xs text-text-secondary">
                {parsedResponse.unmatched_mentions.join(', ')}
              </p>
            </div>
          )}

          <button
            onClick={handleApply}
            disabled={selectedCount === 0}
            className="w-full py-3 rounded-xl bg-secondary text-white font-semibold text-sm disabled:opacity-50 sticky bottom-20"
          >
            Apply {selectedCount} Change{selectedCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {stage === 'applying' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-10 h-10 border-3 border-secondary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-secondary">Applying changes...</p>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
