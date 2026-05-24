// app/api/crm/route.ts
//
// Single route file handling all CRM reads and writes.
// Supports both the standalone CRM HTML app and direct queries from the pipeline app.
//
// Endpoints (all via query params on the same route):
//
//   GET  /api/crm?resource=institutions
//   GET  /api/crm?resource=contacts&institutionId=si3
//   GET  /api/crm?resource=interactions&institutionId=si3
//   GET  /api/crm?resource=profiles&institutionId=si3
//
//   POST /api/crm?resource=institutions     body: institution object (upserts by id)
//   POST /api/crm?resource=contacts         body: contact object
//   POST /api/crm?resource=interactions     body: interaction object
//   POST /api/crm?resource=profiles         body: synthesized profile object

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db'; // adjust path if your db.ts lives elsewhere

// ─── CORS headers ────────────────────────────────────────────────────────────
// Allows the standalone CRM HTML file (opened from your filesystem as file://)
// to call this API. Remove or restrict if you add authentication later.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const resource = searchParams.get('resource');
  const institutionId = searchParams.get('institutionId');

  try {
    switch (resource) {

      case 'institutions': {
        const rows = await sql`
          SELECT * FROM crm_institutions
          ORDER BY updated_at DESC
        `;
        return NextResponse.json(rows, { headers: CORS });
      }

      case 'contacts': {
        const rows = institutionId
          ? await sql`SELECT * FROM crm_contacts WHERE institution_id = ${institutionId} ORDER BY name`
          : await sql`SELECT * FROM crm_contacts ORDER BY name`;
        return NextResponse.json(rows, { headers: CORS });
      }

      case 'interactions': {
        const rows = institutionId
          ? await sql`SELECT * FROM crm_interactions WHERE institution_id = ${institutionId} ORDER BY date DESC`
          : await sql`SELECT * FROM crm_interactions ORDER BY date DESC`;
        return NextResponse.json(rows, { headers: CORS });
      }

      case 'profiles': {
        const rows = institutionId
          ? await sql`SELECT * FROM crm_synthesized_profiles WHERE institution_id = ${institutionId}`
          : await sql`SELECT * FROM crm_synthesized_profiles`;
        return NextResponse.json(rows, { headers: CORS });
      }

      // Convenience: full institution profile in one request
      // GET /api/crm?resource=profile_full&institutionId=si3
      case 'profile_full': {
        if (!institutionId) {
          return NextResponse.json({ error: 'institutionId required' }, { status: 400, headers: CORS });
        }
        const [institution, contacts, interactions, profile] = await Promise.all([
          sql`SELECT * FROM crm_institutions WHERE id = ${institutionId}`,
          sql`SELECT * FROM crm_contacts WHERE institution_id = ${institutionId} ORDER BY name`,
          sql`SELECT * FROM crm_interactions WHERE institution_id = ${institutionId} ORDER BY date DESC`,
          sql`SELECT * FROM crm_synthesized_profiles WHERE institution_id = ${institutionId}`,
        ]);
        return NextResponse.json({
          institution: institution[0] || null,
          contacts,
          interactions,
          profile: profile[0] || null,
        }, { headers: CORS });
      }

      default:
        return NextResponse.json({ error: 'Unknown resource' }, { status: 400, headers: CORS });
    }
  } catch (err) {
    console.error('[CRM GET]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500, headers: CORS });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const resource = searchParams.get('resource');
  const body = await req.json();

  try {
    switch (resource) {

      case 'institutions': {
        const { id, name, type, hq, region, aum, strategy } = body;
        await sql`
          INSERT INTO crm_institutions (id, name, type, hq, region, aum, strategy, updated_at)
          VALUES (${id}, ${name}, ${type}, ${hq}, ${region}, ${aum}, ${strategy}, now())
          ON CONFLICT (id) DO UPDATE SET
            name       = EXCLUDED.name,
            type       = EXCLUDED.type,
            hq         = EXCLUDED.hq,
            region     = EXCLUDED.region,
            aum        = EXCLUDED.aum,
            strategy   = EXCLUDED.strategy,
            updated_at = now()
        `;
        return NextResponse.json({ ok: true }, { headers: CORS });
      }

      case 'contacts': {
        const { id, institution_id, name, role, email, notes } = body;
        await sql`
          INSERT INTO crm_contacts (id, institution_id, name, role, email, notes)
          VALUES (${id}, ${institution_id}, ${name}, ${role}, ${email}, ${notes})
          ON CONFLICT (id) DO UPDATE SET
            name           = EXCLUDED.name,
            role           = EXCLUDED.role,
            email          = EXCLUDED.email,
            notes          = EXCLUDED.notes
        `;
        return NextResponse.json({ ok: true }, { headers: CORS });
      }

      case 'interactions': {
        const { id, institution_id, contact_ids, date, type, location, summary, raw_notes, signals, deals } = body;
        await sql`
          INSERT INTO crm_interactions
            (id, institution_id, contact_ids, date, type, location, summary, raw_notes, signals, deals)
          VALUES (
            ${id}, ${institution_id}, ${contact_ids}, ${date}, ${type},
            ${location}, ${summary}, ${raw_notes},
            ${JSON.stringify(signals)}::jsonb,
            ${JSON.stringify(deals)}::jsonb
          )
          ON CONFLICT (id) DO UPDATE SET
            contact_ids = EXCLUDED.contact_ids,
            date        = EXCLUDED.date,
            type        = EXCLUDED.type,
            location    = EXCLUDED.location,
            summary     = EXCLUDED.summary,
            raw_notes   = EXCLUDED.raw_notes,
            signals     = EXCLUDED.signals,
            deals       = EXCLUDED.deals
        `;
        return NextResponse.json({ ok: true }, { headers: CORS });
      }

      case 'profiles': {
        const { institution_id, investment_thesis, strong_likes, avoids, preferred_structures, typical_deal, coverage_note } = body;
        await sql`
          INSERT INTO crm_synthesized_profiles
            (institution_id, investment_thesis, strong_likes, avoids, preferred_structures, typical_deal, coverage_note, updated_at)
          VALUES (
            ${institution_id}, ${investment_thesis},
            ${strong_likes}, ${avoids}, ${preferred_structures},
            ${typical_deal}, ${coverage_note}, now()
          )
          ON CONFLICT (institution_id) DO UPDATE SET
            investment_thesis   = EXCLUDED.investment_thesis,
            strong_likes        = EXCLUDED.strong_likes,
            avoids              = EXCLUDED.avoids,
            preferred_structures = EXCLUDED.preferred_structures,
            typical_deal        = EXCLUDED.typical_deal,
            coverage_note       = EXCLUDED.coverage_note,
            updated_at          = now()
        `;
        return NextResponse.json({ ok: true }, { headers: CORS });
      }

      // Bulk upsert — used by the CRM HTML app on first sync
      // POST /api/crm?resource=bulk
      // body: { institutions: [...], contacts: [...], interactions: [...] }
      case 'bulk': {
        const { institutions = [], contacts = [], interactions = [] } = body;

        for (const i of institutions) {
          await sql`
            INSERT INTO crm_institutions (id, name, type, hq, region, aum, strategy, updated_at)
            VALUES (${i.id}, ${i.name}, ${i.type}, ${i.hq}, ${i.region}, ${i.aum}, ${i.strategy}, now())
            ON CONFLICT (id) DO NOTHING
          `;
        }
        for (const c of contacts) {
          await sql`
            INSERT INTO crm_contacts (id, institution_id, name, role, email, notes)
            VALUES (${c.id}, ${c.institutionId || c.institution_id}, ${c.name}, ${c.role}, ${c.email}, ${c.notes})
            ON CONFLICT (id) DO NOTHING
          `;
        }
        for (const x of interactions) {
          await sql`
            INSERT INTO crm_interactions
              (id, institution_id, contact_ids, date, type, location, summary, raw_notes, signals, deals)
            VALUES (
              ${x.id}, ${x.institutionId || x.institution_id},
              ${x.contactIds || x.contact_ids || []},
              ${x.date}, ${x.type}, ${x.location}, ${x.summary}, ${x.rawNotes || x.raw_notes || ''},
              ${JSON.stringify(x.signals || [])}::jsonb,
              ${JSON.stringify(x.deals || [])}::jsonb
            )
            ON CONFLICT (id) DO NOTHING
          `;
        }
        return NextResponse.json({ ok: true }, { headers: CORS });
      }

      default:
        return NextResponse.json({ error: 'Unknown resource' }, { status: 400, headers: CORS });
    }
  } catch (err) {
    console.error('[CRM POST]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500, headers: CORS });
  }
}
