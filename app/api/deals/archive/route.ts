import { NextRequest, NextResponse } from 'next/server';
import { sql, validateTable } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { id, table, archive_reason } = await request.json();

  if (!id || !table || !archive_reason?.trim()) {
    return NextResponse.json({ error: 'Missing id, table, or archive_reason' }, { status: 400 });
  }

  const sourceTable = validateTable(table);

  // 1. Fetch the deal
  const rows = await sql(`SELECT * FROM ${sourceTable} WHERE id = $1`, id);
  const deal = rows[0] as Record<string, unknown> | undefined;
  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

  // 2. Build dead_deals record
  const deadDeal: Record<string, unknown> = {
    project: deal.project || '',
    company: deal.company,
    industry: deal.industry || '',
    owner: deal.owner || '',
    ebitda: deal.ebitda || '',
    status: table === 'active_deals' ? (deal.status || '') : (deal.comment || ''),
    timing: deal.timing || '',
    strategy: table === 'active_deals' ? (deal.strategy || '') : (deal.expected_strategy || ''),
    origination: deal.origination || '',
    sponsors_interested: deal.sponsors_interested || '',
    sponsors_declined: deal.sponsors_declined || '',
    advisors: deal.advisors || '',
    archive_reason: archive_reason.trim(),
    archived_from: table,
  };

  const cols = Object.keys(deadDeal).join(', ');
  const placeholders = Object.keys(deadDeal).map((_, i) => `$${i + 1}`).join(', ');

  // 3. Insert into dead_deals
  try {
    await sql(`INSERT INTO dead_deals (${cols}) VALUES (${placeholders})`, ...Object.values(deadDeal));
  } catch (e) {
    return NextResponse.json({ error: `Failed to archive: ${(e as Error).message}` }, { status: 500 });
  }

  // 4. Delete from original table
  try {
    await sql(`DELETE FROM ${sourceTable} WHERE id = $1`, id);
  } catch (e) {
    return NextResponse.json({ error: `Archived but failed to remove from ${table}: ${(e as Error).message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `${deal.company} archived to dead deals` });
}

export async function GET() {
  const rows = await sql(`SELECT * FROM dead_deals ORDER BY archived_at DESC`);
  return NextResponse.json(rows);
}
