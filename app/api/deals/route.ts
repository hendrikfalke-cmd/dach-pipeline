import { NextRequest, NextResponse } from 'next/server';
import { sql, validateTable } from '@/lib/db';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const table = validateTable(params.get('table') || 'active_deals');
  const search = params.get('search') || '';
  const page = parseInt(params.get('page') || '1');
  const limit = Math.min(parseInt(params.get('limit') || '100'), 250);
  const offset = (page - 1) * limit;

  // Duplicate check mode
  const checkDuplicate = params.get('check_duplicate');
  if (checkDuplicate) {
    const q = `%${checkDuplicate.toLowerCase().trim()}%`;
    const results: Array<{ id: string; company: string; table: string }> = [];
    for (const t of ['active_deals', 'expected_deals', 'dead_deals']) {
      const rows = await sql(`SELECT id, company FROM ${t} WHERE LOWER(company) ILIKE $1`, q);
      (rows as Array<{ id: string; company: string }>).forEach(d =>
        results.push({ ...d, table: t })
      );
    }
    return NextResponse.json(results);
  }

  // No pagination — return all
  if (!params.has('page')) {
    let rows;
    if (search) {
      const s = `%${search}%`;
      rows = await sql(
        `SELECT * FROM ${table} WHERE company ILIKE $1 OR industry ILIKE $1 OR owner ILIKE $1 OR project ILIKE $1 ORDER BY created_at DESC`,
        s
      );
    } else {
      rows = await sql(`SELECT * FROM ${table} ORDER BY created_at DESC`);
    }
    return NextResponse.json(rows);
  }

  // Paginated with total count
  let rows;
  if (search) {
    const s = `%${search}%`;
    rows = await sql(
      `SELECT *, COUNT(*) OVER() AS _total FROM ${table} WHERE company ILIKE $1 OR industry ILIKE $1 OR owner ILIKE $1 OR project ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      s, limit, offset
    );
  } else {
    rows = await sql(
      `SELECT *, COUNT(*) OVER() AS _total FROM ${table} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      limit, offset
    );
  }

  const total = rows.length > 0 ? parseInt((rows[0] as Record<string, unknown>)._total as string) : 0;
  const data = rows.map(({ _total, ...rest }: Record<string, unknown>) => rest);

  return NextResponse.json({
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { table, ...dealData } = body;
  const targetTable = validateTable(table || 'active_deals');
  const cols = Object.keys(dealData).join(', ');
  const placeholders = Object.keys(dealData).map((_, i) => `$${i + 1}`).join(', ');
  const rows = await sql(
    `INSERT INTO ${targetTable} (${cols}) VALUES (${placeholders}) RETURNING *`,
    ...Object.values(dealData)
  );
  return NextResponse.json(rows[0]);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, table, ...updates } = body;
  const targetTable = validateTable(table || 'active_deals');
  const setClause = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = [...Object.values(updates), id];
  const rows = await sql(
    `UPDATE ${targetTable} SET ${setClause} WHERE id = $${values.length} RETURNING *`,
    ...values
  );
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function DELETE(request: NextRequest) {
  const { id, table } = await request.json();
  const targetTable = validateTable(table || 'active_deals');
  await sql(`DELETE FROM ${targetTable} WHERE id = $1`, id);
  return NextResponse.json({ success: true });
}
