'use client';

import { useState, useEffect } from 'react';
import { ActiveDeal, ExpectedDeal, DealTable } from '@/lib/types';

interface EditModalProps {
  deal: (ActiveDeal | ExpectedDeal) | null;
  table: DealTable;
  isNew?: boolean;
  onClose: () => void;
  onSave: (data: Record<string, string>, table: DealTable, id?: string) => Promise<void>;
}

const ACTIVE_FIELDS = [
  { key: 'project', label: 'Project Codename' },
  { key: 'company', label: 'Company', required: true },
  { key: 'industry', label: 'Industry' },
  { key: 'owner', label: 'Owner' },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'status', label: 'Status', multiline: true },
  { key: 'timing', label: 'Timing' },
  { key: 'strategy', label: 'Strategy' },
  { key: 'origination', label: 'Origination', multiline: true },
  { key: 'sponsors_interested', label: 'Sponsors Interested' },
  { key: 'sponsors_declined', label: 'Sponsors Declined' },
  { key: 'advisors', label: 'Advisors' },
];

const EXPECTED_FIELDS = [
  { key: 'project', label: 'Project Codename' },
  { key: 'company', label: 'Company', required: true },
  { key: 'industry', label: 'Industry' },
  { key: 'owner', label: 'Owner' },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'comment', label: 'Comment', multiline: true },
  { key: 'timing', label: 'Timing' },
  { key: 'expected_strategy', label: 'Strategy' },
  { key: 'origination', label: 'Origination', multiline: true },
  { key: 'sponsors_interested', label: 'Sponsors Interested' },
  { key: 'sponsors_declined', label: 'Sponsors Declined' },
  { key: 'advisors', label: 'Advisors' },
];

interface DuplicateMatch {
  id: string;
  company: string;
  table: string;
}

export default function EditModal({ deal, table, isNew, onClose, onSave }: EditModalProps) {
  const [selectedTable, setSelectedTable] = useState<DealTable>(table);
  const fields = selectedTable === 'active_deals' ? ACTIVE_FIELDS : EXPECTED_FIELDS;
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);

  useEffect(() => {
    const currentFields = selectedTable === 'active_deals' ? ACTIVE_FIELDS : EXPECTED_FIELDS;
    if (deal && !isNew) {
      const initial: Record<string, string> = {};
      currentFields.forEach(f => {
        initial[f.key] = (deal as unknown as Record<string, unknown>)[f.key] as string || '';
      });
      setForm(initial);
    } else {
      const initial: Record<string, string> = {};
      currentFields.forEach(f => { initial[f.key] = ''; });
      setForm(initial);
    }
  }, [deal, selectedTable, isNew]);

  // Duplicate detection — debounced check when company name changes (only for new deals)
  useEffect(() => {
    if (!isNew || !form.company || form.company.trim().length < 3) {
      setDuplicates([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/deals?check_duplicate=${encodeURIComponent(form.company.trim())}`);
        const data = await res.json();
        setDuplicates(Array.isArray(data) ? data : []);
      } catch {
        setDuplicates([]);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [form.company, isNew]);

  const handleSave = async () => {
    if (!form.company?.trim()) return;
    setSaving(true);
    try {
      const saveTable = isNew ? selectedTable : table;
      await onSave(form, saveTable, deal?.id);
      onClose();
    } catch {
      // error handled by parent
    }
    setSaving(false);
  };

  const tableLabel = (t: string) => t === 'active_deals' ? 'Active' : t === 'expected_deals' ? 'Expected' : 'Dead';

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-4 px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-bg-surface rounded-2xl border border-border sheet-enter flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100dvh - 2rem)' }}>
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-lg">
            {isNew ? 'Add Deal' : `Edit ${deal?.company || ''}`}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Table selector for new deals only */}
        {isNew && (
          <div className="px-5 pb-3 flex gap-2 shrink-0">
            <button
              onClick={() => setSelectedTable('active_deals')}
              className={`flex-1 text-sm font-medium py-2.5 rounded-lg border ${
                selectedTable === 'active_deals' ? 'border-accent bg-accent-dim text-accent' : 'border-border text-text-muted'
              }`}
            >Active</button>
            <button
              onClick={() => setSelectedTable('expected_deals')}
              className={`flex-1 text-sm font-medium py-2.5 rounded-lg border ${
                selectedTable === 'expected_deals' ? 'border-secondary bg-secondary-dim text-secondary' : 'border-border text-text-muted'
              }`}
            >Expected</button>
          </div>
        )}

        {/* Scrollable form */}
        <div className="overflow-y-auto flex-1 overscroll-contain px-5 pb-5">
          <div className="space-y-4">
            {fields.map(field => (
              <div key={field.key}>
                <label className="text-[11px] font-mono uppercase text-text-muted mb-1.5 block">
                  {field.label} {field.required && <span className="text-danger">*</span>}
                </label>
                {field.multiline ? (
                  <textarea
                    value={form[field.key] || ''}
                    onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    className="w-full bg-bg-elevated border border-border rounded-xl px-3.5 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
                    rows={3}
                  />
                ) : (
                  <input
                    type="text"
                    value={form[field.key] || ''}
                    onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    className="w-full bg-bg-elevated border border-border rounded-xl px-3.5 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                  />
                )}

                {/* Duplicate warning — show under company field */}
                {field.key === 'company' && isNew && duplicates.length > 0 && (
                  <div className="mt-2 bg-warning/10 border border-warning/20 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-mono text-warning uppercase mb-1">Possible duplicates found</p>
                    {duplicates.map(d => (
                      <p key={d.id} className="text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">{d.company}</span>
                        <span className="text-text-muted ml-1">({tableLabel(d.table)})</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Save button */}
          <div className="pt-5">
            <button
              onClick={handleSave}
              disabled={saving || !form.company?.trim()}
              className="w-full py-3.5 rounded-xl bg-accent text-white font-semibold text-sm disabled:opacity-50 active:opacity-80"
            >
              {saving ? 'Saving...' : isNew ? (duplicates.length > 0 ? 'Add Anyway' : 'Add Deal') : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
