import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
  const rows = await sql(
    `SELECT * FROM pipeline_uploads ORDER BY created_at DESC LIMIT $1`,
    limit
  );
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const cols = Object.keys(body).join(', ');
  const placeholders = Object.keys(body).map((_, i) => `$${i + 1}`).join(', ');
  const rows = await sql(
    `INSERT INTO pipeline_uploads (${cols}) VALUES (${placeholders}) RETURNING *`,
    ...Object.values(body)
  );
  return NextResponse.json(rows[0]);
}
