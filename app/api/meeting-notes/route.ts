import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    raw_content, parsed_updates, affected_deal_ids,
    meeting_with, meeting_context, deal_companies,
    source_type, deals_added, deals_updated,
  } = body;

  // 1. Create pipeline_uploads record
  let uploadId: string | null = null;
  try {
    const rows = await sql(
      `INSERT INTO pipeline_uploads (upload_type, source_type, raw_text, extracted_data, applied_changes, status, deals_added, deals_updated, deals_removed, meeting_context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      'meeting_notes',
      source_type || 'text',
      raw_content,
      JSON.stringify(parsed_updates || {}),
      JSON.stringify(parsed_updates || {}),
      'applied',
      deals_added || 0,
      deals_updated || 0,
      0,
      meeting_context || meeting_with || ''
    );
    uploadId = (rows[0] as { id: string }).id;
  } catch (e) {
    console.error('Upload log error:', e);
  }

  // 2. Create meeting_notes record
  try {
    await sql(
      `INSERT INTO meeting_notes (upload_id, raw_content, parsed_updates, affected_deal_ids, meeting_with, deal_company)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      uploadId,
      raw_content || '',
      JSON.stringify(parsed_updates || {}),
      affected_deal_ids || [],
      meeting_with || '',
      deal_companies?.length > 0 ? deal_companies[0] : ''
    );
  } catch (e) {
    console.error('Meeting note error:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const person = searchParams.get('person');
  const company = searchParams.get('company');
  const limit = parseInt(searchParams.get('limit') || '50');

  let rows;
  if (person && company) {
    rows = await sql(
      `SELECT * FROM meeting_notes WHERE meeting_with ILIKE $1 AND deal_company ILIKE $2 ORDER BY created_at DESC LIMIT $3`,
      `%${person}%`, `%${company}%`, limit
    );
  } else if (person) {
    rows = await sql(
      `SELECT * FROM meeting_notes WHERE meeting_with ILIKE $1 ORDER BY created_at DESC LIMIT $2`,
      `%${person}%`, limit
    );
  } else if (company) {
    rows = await sql(
      `SELECT * FROM meeting_notes WHERE deal_company ILIKE $1 ORDER BY created_at DESC LIMIT $2`,
      `%${company}%`, limit
    );
  } else {
    rows = await sql(
      `SELECT * FROM meeting_notes ORDER BY created_at DESC LIMIT $1`,
      limit
    );
  }

  return NextResponse.json(rows);
}
