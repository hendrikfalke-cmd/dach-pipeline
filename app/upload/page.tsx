'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PipelineUpload } from '@/lib/types';

export default function UploadHub() {
  const [recentUploads, setRecentUploads] = useState<PipelineUpload[]>([]);

  useEffect(() => {
    fetch('/api/activity?limit=5')
      .then(res => res.json())
      .then(data => setRecentUploads(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  return (
    <div className="px-4 lg:px-8 pt-4">
      <h1 className="text-xl font-bold mb-1">Update Pipeline</h1>
      <p className="text-xs text-text-muted mb-6">Choose how to update your deal pipeline</p>

      <div className="space-y-3 mb-8">
        {/* Pipeline Screenshot */}
        <Link href="/upload/pipeline" className="block">
          <div className="bg-bg-surface border border-border rounded-xl p-5 hover:border-accent/50 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-accent-dim flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary mb-1">Update from Excel</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Upload a screenshot of your pipeline tracker. AI extracts all deals and shows you what changed.
                </p>
                <p className="text-[10px] text-text-muted mt-2 font-mono">Replaces / syncs full pipeline</p>
              </div>
            </div>
          </div>
        </Link>

        {/* Meeting Notes */}
        <Link href="/upload/notes" className="block">
          <div className="bg-bg-surface border border-border rounded-xl p-5 hover:border-secondary/50 transition-colors">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-secondary-dim flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary mb-1">Add Meeting Notes</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Photo of handwritten notes or paste text. AI maps updates to your existing deals.
                </p>
                <p className="text-[10px] text-text-muted mt-2 font-mono">Updates specific deals from meetings</p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent uploads */}
      {recentUploads.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-secondary mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {recentUploads.map((upload) => (
              <div key={upload.id} className="flex items-center gap-3 py-2 px-3 bg-bg-surface rounded-lg border border-border">
                <div className={`w-2 h-2 rounded-full shrink-0 ${upload.upload_type === 'pipeline' ? 'bg-accent' : 'bg-secondary'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-primary truncate">
                    {upload.upload_type === 'pipeline' ? 'Pipeline screenshot' : 'Meeting notes'}
                    {upload.meeting_context && ` — ${upload.meeting_context}`}
                  </p>
                  <p className="text-[10px] text-text-muted font-mono">
                    {new Date(upload.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {(upload.deals_added > 0 || upload.deals_updated > 0) && (
                      <span>
                        {' '}&middot;{' '}
                        {upload.deals_added > 0 && `${upload.deals_added} new`}
                        {upload.deals_added > 0 && upload.deals_updated > 0 && ', '}
                        {upload.deals_updated > 0 && `${upload.deals_updated} updated`}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
