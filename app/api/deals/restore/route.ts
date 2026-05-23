import { NextRequest, NextResponse } from 'next/server';
import { sql, validateTable } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { id, target_table } = await request.json();

  if (!id || !target_table) {
    return NextResponse.json({ error: 'Missing id or target_table' }, { status: 400 });
  }

  const targetTable = validateTable(target_table);

  // 1. Fetch the dead deal
  const rows = await sql(`SELECT * FROM dead_deals WHERE id = $1`, id);
  const deal = rows[0] as Record<string, unknown> | undefined;
  if (!deal) return NextResponse.json({ error: 'Deal not found in archive' }, { status: 404 });

  // 2. Build the restored deal
  const restored: Record<string, unknown> = {
    project: deal.project || '',
    company: deal.company,
    industry: deal.industry || '',
    owner: deal.owner || '',
    ebitda: deal.ebitda || '',
    timing: deal.timing || '',
    origination: deal.origination || '',
    sponsors_interested: deal.sponsors_interested || '',
    sponsors_declined: deal.sponsors_declined || '',
    advisors: deal.advisors || '',
  };

  if (target_table === 'active_deals') {
    restored.status = deal.status || '';
    restored.strategy = deal.strategy || 'MDF';
  } else {
    restored.comment = deal.status || '';
    restored.expected_strategy = deal.strategy || '';
  }

  const cols = Object.keys(restored).join(', ');
  const placeholders = Object.keys(restored).map((_, i) => `$${i + 1}`).join(', ');

  // 3. Insert into target table
  try {
    await sql(`INSERT INTO ${targetTable} (${cols}) VALUES (${placeholders})`, ...Object.values(restored));
  } catch (e) {
    return NextResponse.json({ error: `Failed to restore: ${(e as Error).message}` }, { status: 500 });
  }

  // 4. Delete from dead_deals
  try {
    await sql(`DELETE FROM dead_deals WHERE id = $1`, id);
  } catch (e) {
    return NextResponse.json({ error: `Restored but failed to remove from archive: ${(e as Error).message}` }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `${deal.company} restored to ${target_table === 'active_deals' ? 'Active' : 'Expected'}`,
  });
}
