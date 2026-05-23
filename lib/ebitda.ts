/** Parse EBITDA string to number (midpoint for ranges like "20-25m") */
export function parseEbitda(s: string | undefined | null): number {
  if (!s) return 0;
  // Match ranges like "20-25m", "8-10m"
  const rangeMatch = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    return (parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2;
  }
  // Match single values like "16m", "~12m"
  const singleMatch = s.match(/(\d+)/);
  return singleMatch ? parseInt(singleMatch[1]) : 0;
}
