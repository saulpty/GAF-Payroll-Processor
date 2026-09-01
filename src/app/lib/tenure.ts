// Tenure and contract-date utilities for the Contracts page.
// Pure functions, no I/O. Dates are 'YYYY-MM-DD' strings; timestamps are
// sliced to 10 chars before use. See AGENTS.md §Timezone rules.
// No imports — mirrors ptoAccrual.ts.

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parts(d: string): [number, number, number] {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return [y, m, day];
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number): number {
  const table = [0, 31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return table[m];
}

// Days since 1970-01-01 via UTC so the host timezone never shifts the result.
// This is the only permitted use of Date in this file.
function toDayNumber(d: string): number {
  const [y, m, day] = parts(d);
  return Math.round(Date.UTC(y, m - 1, day) / 86400000);
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * addMonths — calendar-month addition.
 * If the target day does not exist in the target month, clamp to the last day
 * of that month (e.g. Jan 31 + 1 month → Feb 28/29).
 */
export function addMonths(start: string, months: number): string {
  const [y, m, day] = parts(start);
  const totalMonths = (y * 12 + (m - 1)) + months;
  const ty = Math.floor(totalMonths / 12);
  const tm = (totalMonths % 12) + 1;
  const maxDay = daysInMonth(ty, tm);
  const td = Math.min(day, maxDay);
  return `${ty}-${pad2(tm)}-${pad2(td)}`;
}

/**
 * milestones — the five fixed tenure checkpoints for a given start date.
 */
export function milestones(start: string): { key: string; date: string }[] {
  return [
    { key: '1m',  date: addMonths(start, 1)  },
    { key: '3m',  date: addMonths(start, 3)  },
    { key: '6m',  date: addMonths(start, 6)  },
    { key: '1y',  date: addMonths(start, 12) },
    { key: '2y',  date: addMonths(start, 24) },
  ];
}

/**
 * tenureLabel — elapsed whole years + months as a human label.
 * A month only counts once the day-of-month has been reached.
 *   < 1 month   → 'new'
 *   < 1 year    → '5m', '9m', …
 *   exact years → '1y', '2y', …
 *   otherwise   → '1y 5m', …
 */
export function tenureLabel(start: string, asOf: string): string {
  const [sy, sm, sd] = parts(start);
  const [ay, am, ad] = parts(asOf);

  // Total elapsed months, adjusted for whether the day-of-month has been reached.
  let months = (ay * 12 + (am - 1)) - (sy * 12 + (sm - 1));
  if (ad < sd) months -= 1;

  if (months < 1)  return 'new';

  const years = Math.floor(months / 12);
  const remMonths = months % 12;

  if (years === 0) return `${remMonths}m`;
  if (remMonths === 0) return `${years}y`;
  return `${years}y ${remMonths}m`;
}

/**
 * daysUntil — plain calendar days from `from` to `to`.
 * Positive = future, negative = past, 0 = same day.
 */
export function daysUntil(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from);
}

/**
 * nextMilestone — first milestone on or after asOf, with days remaining.
 * Returns null when all five milestones have already passed.
 */
export function nextMilestone(
  start: string,
  asOf: string,
): { key: string; date: string; days: number } | null {
  for (const m of milestones(start)) {
    // A milestone falling today still counts (daysUntil returns 0, >= 0).
    const d = daysUntil(asOf, m.date);
    if (d >= 0) return { key: m.key, date: m.date, days: d };
  }
  return null;
}

/**
 * contractEndState — classifies a contract end date relative to asOf.
 * 'none'   — no end date recorded
 * 'ended'  — end date is before asOf (normal for long-tenure staff)
 * 'future' — end date is asOf or later
 */
export function contractEndState(
  end: string | null,
  asOf: string,
): { kind: 'none' | 'ended' | 'future'; days: number | null } {
  // Slice before comparing so Postgres timestamps ('2026-09-02T00:00:00.000Z')
  // are treated as date strings, never parsed as Date objects.
  if (!end || end.trim() === '') return { kind: 'none', days: null };
  const d = daysUntil(asOf, end.slice(0, 10));
  return d < 0
    ? { kind: 'ended',  days: d }
    : { kind: 'future', days: d };
}
