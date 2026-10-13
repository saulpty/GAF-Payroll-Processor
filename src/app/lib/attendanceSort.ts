import type { EmpStats } from '@/app/lib/attendanceStats';

// The order of the Attendance → List rows: one rule, used by the computer's table
// (AttendanceTable.tsx) and by the phone's rows (AttendanceListRows.tsx). Pure: no React, no
// loading. The comparison is the one the table has always used, moved here unchanged.

/** What the List can be ordered by: any field of an employee's numbers, or the Reporting ratio. */
export type SortKey = keyof EmpStats | 'reporting';
export type SortDir = 'asc' | 'desc';

/** Ratio for sorting: -1 means needed=0 (always last in both directions) */
function reportingRatio(s: EmpStats): number {
  if (s.filing.needed === 0) return -1;
  return s.filing.filed / s.filing.needed;
}

/** Negative: a comes first. Positive: b comes first. 0: they keep the order they arrived in. */
export function compareEmployeeStats(a: EmpStats, b: EmpStats, sortKey: SortKey, sortDir: SortDir): number {
  if (sortKey === 'reporting') {
    const ar = reportingRatio(a), br = reportingRatio(b);
    // needed=0 rows always last (ratio=-1) regardless of direction
    if (ar === -1 && br === -1) return 0;
    if (ar === -1) return 1;
    if (br === -1) return -1;
    return sortDir === 'asc' ? ar - br : br - ar;
  }
  const av = a[sortKey as keyof EmpStats], bv = b[sortKey as keyof EmpStats];
  if (typeof av === 'string' && typeof bv === 'string')
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  if (typeof av === 'number' && typeof bv === 'number')
    return sortDir === 'asc' ? av - bv : bv - av;
  return 0;
}

/** A new list in the asked-for order. The list handed in is not changed. */
export function sortEmployeeStats(list: EmpStats[], sortKey: SortKey, sortDir: SortDir): EmpStats[] {
  return [...list].sort((a, b) => compareEmployeeStats(a, b, sortKey, sortDir));
}

/** The search box: employees whose name contains the text, upper or lower case. */
export function filterByName(list: EmpStats[], search: string): EmpStats[] {
  return list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
}

export type PhoneSort = { key: SortKey; dir: SortDir; label: string };

/**
 * The phone's "Sort By" box. A phone has no column headers to tap, so each choice has one fixed
 * direction: names A to Z, every number with the people who most need a look first.
 */
export const PHONE_SORTS: readonly PhoneSort[] = [
  { key: 'name', dir: 'asc', label: 'Name (A to Z)' },
  { key: 'pctOnTime', dir: 'asc', label: '% On-Time (Lowest First)' },
  { key: 'unreported', dir: 'desc', label: 'Unreported (Most First)' },
  { key: 'absent', dir: 'desc', label: 'Absent (Most First)' },
  { key: 'totalLate', dir: 'desc', label: 'Total Late (Most First)' },
];

/** The choice with that key; anything unknown falls back to Name. */
export function phoneSort(key: string): PhoneSort {
  return PHONE_SORTS.find(o => o.key === key) ?? PHONE_SORTS[0];
}

/** The nothing-found line: it names every filter that is switched on, in the filter bar's words. */
export function listNothingFound(f: { employee?: string; manager?: string; role?: string }): string {
  const parts: string[] = [];
  const employee = (f.employee ?? '').trim();
  if (employee) parts.push(`Employee: ${employee}`);
  if (f.manager) parts.push(`Manager: ${f.manager}`);
  if (f.role) parts.push(`Title: ${f.role}`);
  return parts.length ? `No employees match ${parts.join(' · ')}` : 'No employees to show.';
}
