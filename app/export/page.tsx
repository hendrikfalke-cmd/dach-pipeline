'use client';

import { useState } from 'react';
import Toast from '@/components/Toast';

type ExportType = 'active' | 'expected' | 'full' | 'dead' | 'notes';

export default function ExportPage() {
  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleExport = async (type: ExportType) => {
    setExporting(type);
    try {
      if (type === 'notes') {
        await exportNotes();
      } else if (type === 'dead') {
        await exportDead();
      } else {
        await exportDeals(type);
      }
    } catch {
      setToast({ message: 'Export failed', type: 'error' });
    }
    setExporting(null);
  };

  const exportDeals = async (type: 'active' | 'expected' | 'full') => {
    const tables = type === 'full'
      ? ['active_deals', 'expected_deals']
      : [type === 'active' ? 'active_deals' : 'expected_deals'];

    const allRows: string[][] = [];
    allRows.push(['Project', 'Company', 'Industry', 'Owner', 'EBITDA', 'Status/Comment', 'Timing', 'Strategy', 'Origination', 'Sponsors Interested', 'Sponsors Declined', 'Advisors', 'Type']);

    for (const table of tables) {
      const res = await fetch(`/api/deals?table=${table}`);
      const deals = await res.json();
      if (!Array.isArray(deals)) continue;
      const isActive = table === 'active_deals';
      for (const d of deals) {
        allRows.push([
          d.project || '', d.company || '', d.industry || '', d.owner || '', d.ebitda || '',
          isActive ? (d.status || '') : (d.comment || ''), d.timing || '',
          isActive ? (d.strategy || '') : (d.expected_strategy || ''),
          d.origination || '', d.sponsors_interested || '', d.sponsors_declined || '', d.advisors || '',
          isActive ? 'Active' : 'Expected',
        ]);
      }
    }
    downloadCsv(allRows, `dach-pipeline-${type}`);
    setToast({ message: `Exported ${allRows.length - 1} deals`, type: 'success' });
  };

  const exportDead = async () => {
    const res = await fetch('/api/deals/archive');
    const deals = await res.json();
    if (!Array.isArray(deals)) throw new Error('No data');

    const allRows: string[][] = [];
    allRows.push(['Company', 'Industry', 'Owner', 'EBITDA', 'Status', 'Strategy', 'Archive Reason', 'Archived From', 'Archived Date', 'Sponsors Interested', 'Sponsors Declined', 'Advisors']);
    for (const d of deals) {
      allRows.push([
        d.company || '', d.industry || '', d.owner || '', d.ebitda || '', d.status || '',
        d.strategy || '', d.archive_reason || '',
        d.archived_from === 'active_deals' ? 'Active' : 'Expected',
        d.archived_at ? new Date(d.archived_at).toLocaleDateString('en-GB') : '',
        d.sponsors_interested || '', d.sponsors_declined || '', d.advisors || '',
      ]);
    }
    downloadCsv(allRows, 'dach-pipeline-dead-deals');
    setToast({ message: `Exported ${allRows.length - 1} dead deals`, type: 'success' });
  };

  const exportNotes = async () => {
    const res = await fetch('/api/meeting-notes?limit=200');
    const notes = await res.json();
    if (!Array.isArray(notes)) throw new Error('No data');

    const allRows: string[][] = [];
    allRows.push(['Date', 'Meeting With', 'Company', 'Summary', 'Raw Notes']);
    for (const n of notes) {
      const parsed = n.parsed_updates as { meeting_summary?: string } | undefined;
      allRows.push([
        n.created_at ? new Date(n.created_at).toLocaleDateString('en-GB') : '',
        n.meeting_with || '',
        n.deal_company || '',
        parsed?.meeting_summary || '',
        n.raw_content || '',
      ]);
    }
    downloadCsv(allRows, 'dach-pipeline-meeting-notes');
    setToast({ message: `Exported ${allRows.length - 1} meeting notes`, type: 'success' });
  };

  const downloadCsv = (rows: string[][], filename: string) => {
    const BOM = '\uFEFF';
    const csv = BOM + rows.map(row =>
      row.map(cell => `"${(cell || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`).join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-4 lg:px-8 pt-4 pb-8">
      <h1 className="text-xl font-bold mb-1">Export</h1>
      <p className="text-xs text-text-muted mb-6">Download as CSV (UTF-8 with BOM for Excel)</p>

      <div className="space-y-3">
        <p className="text-[10px] font-mono uppercase text-text-muted">Pipeline</p>
        <ExportButton title="Active Deals" description="All deals in the active pipeline" color="accent" loading={exporting === 'active'} onClick={() => handleExport('active')} />
        <ExportButton title="Expected Deals" description="All deals in the expected pipeline" color="secondary" loading={exporting === 'expected'} onClick={() => handleExport('expected')} />
        <ExportButton title="Full Pipeline" description="Both active and expected deals" color="accent" loading={exporting === 'full'} onClick={() => handleExport('full')} />

        <p className="text-[10px] font-mono uppercase text-text-muted pt-2">Archive & Notes</p>
        <ExportButton title="Dead Deals" description="All archived deals with reasons" color="warning" loading={exporting === 'dead'} onClick={() => handleExport('dead')} />
        <ExportButton title="Meeting Notes" description="All meeting notes with summaries" color="secondary" loading={exporting === 'notes'} onClick={() => handleExport('notes')} />
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function ExportButton({ title, description, color, loading, onClick }: {
  title: string; description: string; color: string; loading: boolean; onClick: () => void;
}) {
  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    accent: { bg: 'bg-accent-dim', text: 'text-accent', border: 'border-accent' },
    secondary: { bg: 'bg-secondary-dim', text: 'text-secondary', border: 'border-secondary' },
    warning: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning' },
  };
  const c = colorClasses[color] || colorClasses.accent;

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full text-left bg-bg-surface border border-border rounded-xl p-4 hover:border-border-light transition-colors disabled:opacity-60"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.bg}`}>
          {loading ? (
            <div className={`w-5 h-5 border-2 ${c.border} border-t-transparent rounded-full animate-spin`} />
          ) : (
            <svg className={`w-5 h-5 ${c.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          )}
        </div>
        <div>
          <h3 className="font-semibold text-sm text-text-primary">{title}</h3>
          <p className="text-xs text-text-muted">{description}</p>
        </div>
      </div>
    </button>
  );
}
