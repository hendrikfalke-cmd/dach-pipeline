import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');

  const [activeRows, expectedRows, deadRows] = await Promise.all([
    sql(`SELECT * FROM active_deals`),
    sql(`SELECT * FROM expected_deals`),
    sql(`SELECT * FROM dead_deals`),
  ]);

  const allActive = activeRows as Array<Record<string, string>>;
  const allExpected = expectedRows as Array<Record<string, string>>;
  const allDead = deadRows as Array<Record<string, string>>;
  const allDeals = [...allActive, ...allExpected];

  if (name) {
    const nameLower = name.toLowerCase().trim();
    const interested = allDeals.filter(d => d.sponsors_interested?.toLowerCase().includes(nameLower));
    const declined = allDeals.filter(d => d.sponsors_declined?.toLowerCase().includes(nameLower));
    const advising = allDeals.filter(d => d.advisors?.toLowerCase().includes(nameLower));
    const deadInterested = allDead.filter(d =>
      d.sponsors_interested?.toLowerCase().includes(nameLower) ||
      d.sponsors_declined?.toLowerCase().includes(nameLower)
    );
    return NextResponse.json({
      name,
      interestedDeals: interested,
      declinedDeals: declined,
      advisingDeals: advising,
      deadDeals: deadInterested,
      totalDeals: new Set([...interested, ...declined, ...advising].map(d => d.id)).size,
    });
  }

  const sponsorMap = new Map<string, { interested: number; declined: number; advising: number }>();
  const addSponsor = (n: string, field: 'interested' | 'declined' | 'advising') => {
    const trimmed = n.trim();
    if (!trimmed) return;
    const existing = sponsorMap.get(trimmed) || { interested: 0, declined: 0, advising: 0 };
    existing[field]++;
    sponsorMap.set(trimmed, existing);
  };

  allDeals.forEach(d => {
    d.sponsors_interested?.split(',').forEach((s: string) => addSponsor(s, 'interested'));
    d.sponsors_declined?.split(',').forEach((s: string) => addSponsor(s, 'declined'));
    d.advisors?.split(',').forEach((s: string) => addSponsor(s, 'advising'));
  });

  const sponsors = [...sponsorMap.entries()]
    .map(([n, counts]) => ({ name: n, ...counts, total: counts.interested + counts.declined + counts.advising }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json(sponsors);
}
