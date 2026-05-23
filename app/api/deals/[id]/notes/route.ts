import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await sql(
    `SELECT * FROM meeting_notes WHERE affected_deal_ids @> ARRAY[$1::uuid] ORDER BY created_at DESC`,
    [id]
  );
  return NextResponse.json(rows);
}
