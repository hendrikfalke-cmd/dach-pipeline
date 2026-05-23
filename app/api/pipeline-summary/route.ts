import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('key');
  const expectedKey = process.env.PIPELINE_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [activeRows, expectedRows, deadRows] = await Promise.all([
    sql(`SELECT * FROM active_deals ORDER BY updated_at DESC`),
    sql(`SELECT * FROM expected_deals ORDER BY updated_at DESC`),
    sql(`SELECT * FROM dead_deals ORDER BY archived_at DESC`),
  ]);

  const active = activeRows as Array<Record<string, string>>;
  const expected = expectedRows as Array<Record<string, string>>;
  const dead = deadRows as Array<Record<string, string>>;

  const format = request.nextUrl.searchParams.get('format');

  if (format === 'text') {
    let text = `DACH PIPELINE SUMMARY — ${new Date().toISOString().split('T')[0]}\n`;
    text += `${'='.repeat(60)}\n\n`;

    text += `ACTIVE DEALS (${active.length}):\n${'-'.repeat(40)}\n`;
    for (const d of active) {
      text += `• ${d.company}${d.project ? ` (${d.project})` : ''}\n`;
      if (d.ebitda) text += `  EBITDA: ${d.ebitda}\n`;
      if (d.industry) text += `  Industry: ${d.industry}\n`;
      if (d.owner) text += `  Owner: ${d.owner}\n`;
      if (d.status) text += `  Status: ${d.status}\n`;
      if (d.timing) text += `  Timing: ${d.timing}\n`;
      if (d.strategy) text += `  Strategy: ${d.strategy}\n`;
      if (d.origination) text += `  Origination: ${d.origination}\n`;
      if (d.sponsors_interested) text += `  Sponsors interested: ${d.sponsors_interested}\n`;
      if (d.sponsors_declined) text += `  Sponsors declined: ${d.sponsors_declined}\n`;
      if (d.advisors) text += `  Advisors: ${d.advisors}\n`;
      text += `\n`;
    }

    text += `\nEXPECTED DEALS (${expected.length}):\n${'-'.repeat(40)}\n`;
    for (const d of expected) {
      text += `• ${d.company}${d.project ? ` (${d.project})` : ''}\n`;
      if (d.ebitda) text += `  EBITDA: ${d.ebitda}\n`;
      if (d.industry) text += `  Industry: ${d.industry}\n`;
      if (d.owner) text += `  Owner: ${d.owner}\n`;
      if (d.comment) text += `  Comment: ${d.comment}\n`;
      if (d.timing) text += `  Timing: ${d.timing}\n`;
      if (d.expected_strategy) text += `  Strategy: ${d.expected_strategy}\n`;
      if (d.origination) text += `  Origination: ${d.origination}\n`;
      if (d.sponsors_interested) text += `  Sponsors interested: ${d.sponsors_interested}\n`;
      if (d.sponsors_declined) text += `  Sponsors declined: ${d.sponsors_declined}\n`;
      if (d.advisors) text += `  Advisors: ${d.advisors}\n`;
      text += `\n`;
    }

    if (dead.length > 0) {
      text += `\nDEAD DEALS (${dead.length}):\n${'-'.repeat(40)}\n`;
      for (const d of dead) {
        text += `• ${d.company}${d.project ? ` (${d.project})` : ''} — REASON: ${d.archive_reason}\n`;
        if (d.ebitda) text += `  EBITDA: ${d.ebitda}\n`;
        text += `\n`;
      }
    }

    return new NextResponse(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  return NextResponse.json({
    as_of: new Date().toISOString(),
    active_deals: active,
    expected_deals: expected,
    dead_deals: dead,
    counts: { active: active.length, expected: expected.length, dead: dead.length },
  });
}
