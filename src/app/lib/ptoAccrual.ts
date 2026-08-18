// PTO accrual rules for GAF Healthcare Panama. Pure functions, no I/O.
// Dates are 'YYYY-MM-DD' strings. No Date objects are constructed for the
// arithmetic here — see AGENTS.md, Timezone rules.

function parts(d: string): [number, number, number] {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return [y, m, day];
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function isLastDayOfFeb(y: number, m: number, d: number): boolean {
  return m === 2 && d === (isLeap(y) ? 29 : 28);
}

/**
 * Excel DAYS360, US (NASD) method — the formula the PTO tracker workbook uses.
 *  - If start is the 31st or the last day of February, start day = 30.
 *  - If end is the 31st: if start day < 30 the end becomes the 1st of the next
 *    month, otherwise the end day = 30.
 */
export function days360(start: string, end: string): number {
  const [y1, m1, d1raw] = parts(start);
  const [y2raw, m2raw, d2raw] = parts(end);
  let d1 = d1raw;
  let d2 = d2raw;
  let m2 = m2raw;
  let y2 = y2raw;
  if (d1 === 31 || isLastDayOfFeb(y1, m1, d1)) d1 = 30;
  if (d2 === 31) {
    if (d1 < 30) { d2 = 1; m2 += 1; if (m2 === 13) { m2 = 1; y2 += 1; } }
    else d2 = 30;
  }
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

/** Accumulated PTO days: 1 day per 11 DAYS360 days (≈ 33 per year). */
export function accruedPto(start: string, asOf: string): number {
  return days360(start, asOf) / 11;
}

/** Sum of total_days over recorded ledger rows only. SQL may return numerics as strings. */
export function takenPto(rows: { total_days: number | string | null; status: string }[]): number {
  return rows.reduce((sum, r) => r.status === 'recorded' ? sum + (Number(r.total_days) || 0) : sum, 0);
}

function toDayNumber(d: string): number {
  // Days since 1970-01-01 using UTC so no local timezone can shift the result.
  const [y, m, day] = parts(d);
  return Math.round(Date.UTC(y, m - 1, day) / 86400000);
}

function fromDayNumber(n: number): string {
  return new Date(n * 86400000).toISOString().slice(0, 10);
}

/** Calendar days between leave_on and return_on — what every row in the sheet is. */
export function defaultTotalDays(leaveOn: string, returnOn: string): number {
  return toDayNumber(returnOn) - toDayNumber(leaveOn);
}

/** Floating holidays: eligible 90 calendar days after hire. */
export function fhEligibleDate(start: string): string {
  return fromDayNumber(toDayNumber(start) + 90);
}

export function fhRemaining(allocated: number, used: number): number {
  return Math.max(0, (Number(allocated) || 0) - (Number(used) || 0));
}
