import { ActiveDeal, ExpectedDeal, ParsedDeal, DealDiff, FieldChange, DealTable } from './types';

function normalize(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  // Simple character overlap ratio
  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;
  if (longer.includes(shorter)) return shorter.length / longer.length;
  let matches = 0;
  const chars = shorter.split('');
  const used = new Set<number>();
  for (const c of chars) {
    for (let i = 0; i < longer.length; i++) {
      if (!used.has(i) && longer[i] === c) {
        matches++;
        used.add(i);
        break;
      }
    }
  }
  return matches / longer.length;
}

function findMatch<T extends { company: string }>(
  parsed: ParsedDeal,
  deals: T[],
  threshold = 0.85
): T | undefined {
  let best: T | undefined;
  let bestScore = 0;
  for (const deal of deals) {
    const score = similarity(parsed.company, deal.company);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      best = deal;
    }
  }
  return best;
}

const ACTIVE_FIELDS = ['project', 'company', 'industry', 'owner', 'ebitda', 'status', 'timing', 'strategy', 'origination', 'sponsors_interested', 'sponsors_declined', 'advisors'] as const;
const EXPECTED_FIELDS = ['project', 'company', 'industry', 'owner', 'ebitda', 'comment', 'timing', 'expected_strategy', 'origination', 'sponsors_interested', 'sponsors_declined', 'advisors'] as const;

export function computeDiffs(
  parsedActive: ParsedDeal[],
  parsedExpected: ParsedDeal[],
  dbActive: ActiveDeal[],
  dbExpected: ExpectedDeal[]
): DealDiff[] {
  const diffs: DealDiff[] = [];
  const matchedActiveIds = new Set<string>();
  const matchedExpectedIds = new Set<string>();

  // Match parsed active deals
  for (const parsed of parsedActive) {
    const match = findMatch(parsed, dbActive);
    if (match) {
      matchedActiveIds.add(match.id);
      const changes: FieldChange[] = [];
      for (const field of ACTIVE_FIELDS) {
        const oldVal = (match as unknown as Record<string, string>)[field] || '';
        const newVal = (parsed as unknown as Record<string, string>)[field] || '';
        if (normalize(oldVal) !== normalize(newVal) && newVal) {
          changes.push({ field, oldValue: oldVal, newValue: newVal });
        }
      }
      diffs.push({
        status: changes.length > 0 ? 'changed' : 'unchanged',
        company: parsed.company,
        table: 'active_deals',
        existingDeal: match,
        parsedDeal: parsed,
        changes,
        selected: changes.length > 0,
      });
    } else {
      diffs.push({
        status: 'new',
        company: parsed.company,
        table: 'active_deals',
        parsedDeal: parsed,
        selected: true,
      });
    }
  }

  // Match parsed expected deals
  for (const parsed of parsedExpected) {
    const match = findMatch(parsed, dbExpected);
    if (match) {
      matchedExpectedIds.add(match.id);
      const changes: FieldChange[] = [];
      for (const field of EXPECTED_FIELDS) {
        const oldVal = (match as unknown as Record<string, string>)[field] || '';
        const newVal = (parsed as unknown as Record<string, string>)[field] || '';
        if (normalize(oldVal) !== normalize(newVal) && newVal) {
          changes.push({ field, oldValue: oldVal, newValue: newVal });
        }
      }
      diffs.push({
        status: changes.length > 0 ? 'changed' : 'unchanged',
        company: parsed.company,
        table: 'expected_deals',
        existingDeal: match,
        parsedDeal: parsed,
        changes,
        selected: changes.length > 0,
      });
    } else {
      diffs.push({
        status: 'new',
        company: parsed.company,
        table: 'expected_deals',
        parsedDeal: parsed,
        selected: true,
      });
    }
  }

  // Removed deals (in DB but not in parsed)
  for (const deal of dbActive) {
    if (!matchedActiveIds.has(deal.id)) {
      diffs.push({
        status: 'removed',
        company: deal.company,
        table: 'active_deals',
        existingDeal: deal,
        selected: false,
      });
    }
  }
  for (const deal of dbExpected) {
    if (!matchedExpectedIds.has(deal.id)) {
      diffs.push({
        status: 'removed',
        company: deal.company,
        table: 'expected_deals',
        existingDeal: deal,
        selected: false,
      });
    }
  }

  return diffs;
}
