'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from '@/components/ImageUpload';
import DiffView from '@/components/DiffView';
import Toast from '@/components/Toast';
import { DealDiff, ActiveDeal, ExpectedDeal } from '@/lib/types';
import { computeDiffs } from '@/lib/diff';

type Stage = 'upload' | 'processing' | 'review' | 'applying';

export default function PipelineUpload() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [diffs, setDiffs] = useState<DealDiff[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (!imageFile) return;
    setStage('processing');
    setError(null);

    try {
      // 1. Parse the image
      const formData = new FormData();
      formData.append('image', imageFile);
      const parseRes = await fetch('/api/parse-pipeline', { method: 'POST', body: formData });
      if (!parseRes.ok) {
        const err = await parseRes.json();
        throw new Error(err.error || 'Failed to parse image');
      }
      const parsed = await parseRes.json();

      // 2. Fetch current DB deals
      const [activeRes, expectedRes] = await Promise.all([
        fetch('/api/deals?table=active_deals'),
        fetch('/api/deals?table=expected_deals'),
      ]);
      const activeDeals: ActiveDeal[] = await activeRes.json();
      const expectedDeals: ExpectedDeal[] = await expectedRes.json();

      // 3. Compute diffs
      const computed = computeDiffs(
        parsed.active_deals || [],
        parsed.expected_deals || [],
        activeDeals || [],
        expectedDeals || []
      );
      setDiffs(computed);
      setStage('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStage('upload');
    }
  };

  const handleToggle = (index: number) => {
    setDiffs(prev => prev.map((d, i) => i === index ? { ...d, selected: !d.selected } : d));
  };

  const handleApply = async () => {
    setStage('applying');
    const selected = diffs.filter(d => d.selected);
    let added = 0, updated = 0, removed = 0;

    try {
      for (const diff of selected) {
        if (diff.status === 'new' && diff.parsedDeal) {
          await fetch('/api/deals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...diff.parsedDeal, table: diff.table }),
          });
          added++;
        } else if (diff.status === 'changed' && diff.existingDeal && diff.changes) {
          const updates: Record<string, string> = {};
          diff.changes.forEach(c => { updates[c.field] = c.newValue; });
          await fetch('/api/deals', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: diff.existingDeal.id, table: diff.table, ...updates }),
          });
          updated++;
        } else if (diff.status === 'removed' && diff.existingDeal) {
          await fetch('/api/deals', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: diff.existingDeal.id, table: diff.table }),
          });
          removed++;
        }
      }

      // Log the upload
      await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_type: 'pipeline',
          source_type: 'image',
          status: 'applied',
          deals_added: added,
          deals_updated: updated,
          deals_removed: removed,
        }),
      });

      setToast({ message: `Applied: ${added} added, ${updated} updated, ${removed} removed`, type: 'success' });
      setTimeout(() => router.push('/'), 1500);
    } catch {
      setToast({ message: 'Failed to apply some changes', type: 'error' });
      setStage('review');
    }
  };

  const selectedCount = diffs.filter(d => d.selected).length;

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
          <h1 className="text-lg font-bold">Pipeline Screenshot</h1>
          <p className="text-[10px] text-text-muted font-mono">Upload Excel screenshot for AI extraction</p>
        </div>
      </div>

      {stage === 'upload' && (
        <div className="space-y-4">
          <ImageUpload
            onImageSelected={(file) => setImageFile(file)}
            label="Take photo or upload screenshot"
          />
          {error && (
            <div className="text-xs text-danger bg-danger/10 rounded-lg p-3 border border-danger/20">
              {error}
            </div>
          )}
          {imageFile && (
            <button
              onClick={handleProcess}
              className="w-full py-3 rounded-xl bg-accent text-white font-semibold text-sm"
            >
              Process Screenshot
            </button>
          )}
        </div>
      )}

      {stage === 'processing' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-secondary">Extracting deals from screenshot...</p>
          <p className="text-[10px] text-text-muted">This may take 10-20 seconds</p>
        </div>
      )}

      {stage === 'review' && (
        <div className="space-y-4">
          <DiffView diffs={diffs} onToggle={handleToggle} />
          <button
            onClick={handleApply}
            disabled={selectedCount === 0}
            className="w-full py-3 rounded-xl bg-accent text-white font-semibold text-sm disabled:opacity-50 sticky bottom-20"
          >
            Apply {selectedCount} Change{selectedCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {stage === 'applying' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-secondary">Applying changes...</p>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
