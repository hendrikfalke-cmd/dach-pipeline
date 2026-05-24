import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(prefix = 'ix') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Try to find a CRM institution whose name fuzzy-matches the `meeting_with`
 * string returned by the AI parser. We check:
 *   1. Exact case-insensitive match
 *   2. Institution name is contained in the meeting_with string
 *   3. Any word in institution name is contained in meeting_with string (≥5 chars)
 */
function matchInstitution(
  meetingWith: string,
  institutions: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  if (!meetingWith?.trim() || !institutions.length) return null;

  const haystack = meetingWith.toLowerCase().trim();

  // 1. Exact match
  const exact = institutions.find(i => i.name.toLowerCase().trim() === haystack);
  if (exact) return exact;

  // 2. Institution name is a substring of meeting_with
  const sub = institutions.find(i => haystack.includes(i.name.toLowerCase().trim()));
  if (sub) return sub;

  // 3. Any significant word (≥5 chars) in institution name appears in meeting_with
  const wordMatch = institutions.find(i => {
    const words = i.name.toLowerCase().split(/\s+/).filter(w => w.length >= 5);
    return words.some(w => haystack.includes(w));
  });
  return wordMatch || null;
}

// ─── POST ─────────────────────────────────────────────────────────────────────

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
      ['meeting_notes', source_type || 'text', raw_content,
       JSON.stringify(parsed_updates || {}), JSON.stringify(parsed_updates || {}),
       'applied', deals_added || 0, deals_updated || 0, 0,
       meeting_context || meeting_with || '']
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
      [uploadId, raw_content || '', JSON.stringify(parsed_updates || {}),
       affected_deal_ids || [], meeting_with || '',
       deal_companies?.length > 0 ? deal_companies[0] : '']
    );
  } catch (e) {
    console.error('Meeting note error:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  // 3. Auto-log to Sponsor CRM if meeting_with matches a known institution
  let crmLogged = false;
  let crmInstitutionName: string | null = null;

  try {
    // Only attempt if we have something in meeting_with
    const meetingWithStr = (meeting_with || meeting_context || '').trim();
    if (meetingWithStr) {
      const institutions = await sql(
        `SELECT id, name FROM crm_institutions`
      ) as Array<{ id: string; name: string }>;

      const match = matchInstitution(meetingWithStr, institutions);

      if (match) {
        const today = new Date().toISOString().slice(0, 10);
        const summary = (parsed_updates as { meeting_summary?: string } | null)?.meeting_summary || '';
        const dealsList = JSON.stringify(
          Array.isArray(deal_companies) ? deal_companies.filter(Boolean) : []
        );

        await sql(
          `INSERT INTO crm_interactions
             (id, institution_id, contact_ids, date, type, location, summary, raw_notes, signals, deals)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          [
            uid('ix'),
            match.id,
            [],            // contact_ids — unknown from meeting notes
            today,
            'Meeting',
            '',            // location unknown
            summary,
            raw_content || '',
            '[]',          // signals empty — user can extract later with AI
            dealsList,
          ]
        );

        crmLogged = true;
        crmInstitutionName = match.name;
      }
    }
  } catch (e) {
    // Non-fatal — CRM logging failure should not break the meeting note save
    console.error('CRM auto-log error:', e);
  }

  return NextResponse.json({
    success: true,
    ...(crmLogged && { crm_logged: true, crm_institution: crmInstitutionName }),
  });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const person = searchParams.get('person');
  const company = searchParams.get('company');
  const limit = parseInt(searchParams.get('limit') || '50');

  let rows;
  if (person && company) {
    rows = await sql(
      `SELECT * FROM meeting_notes WHERE meeting_with ILIKE $1 AND deal_company ILIKE $2 ORDER BY created_at DESC LIMIT $3`,
      [`%${person}%`, `%${company}%`, limit]
    );
  } else if (person) {
    rows = await sql(
      `SELECT * FROM meeting_notes WHERE meeting_with ILIKE $1 ORDER BY created_at DESC LIMIT $2`,
      [`%${person}%`, limit]
    );
  } else if (company) {
    rows = await sql(
      `SELECT * FROM meeting_notes WHERE deal_company ILIKE $1 ORDER BY created_at DESC LIMIT $2`,
      [`%${company}%`, limit]
    );
  } else {
    rows = await sql(
      `SELECT * FROM meeting_notes ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
  }

  return NextResponse.json(rows);
}
