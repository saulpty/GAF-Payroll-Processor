# Phone view, Attendance → List, part 1 of 2 (the shared ordering rule)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today Attendance → List is the computer's 17-column table inside a box that slides
sideways, and the only way to change the order is to tap a column header that is usually off the
screen. This prompt gives a phone-sized screen one row per employee (name, role, the Good / Fair /
At Risk pill, then % on time, Late, Unreported, Absent and the Reporting pill) with one "Sort By"
box above them. Tapping a row opens the employee panel, exactly as a click on a table row does.
The table's ordering rule moves, unchanged, into one small file that both the table and the rows
use. A computer keeps exactly what it has, including the order of the rows for every column.

**This is part 1 of 2.** It moves the table's ordering rule, unchanged, into one new small file and makes the table use it, and it makes the table's two pills importable. Nothing on any screen changes after this part, on a phone or on a computer. Part 2 follows as a separate prompt. Write everything exactly as given: do not adapt or shorten it. Exports that nothing imports yet are expected: leave them.

**Only these files may change.** One new: `src/app/lib/attendanceSort.ts`. One edited: `src/app/pages/attendance/AttendanceTable.tsx`. **No other file may be touched.** No migration, no action file.

Rules:
- Only these files may change: the two listed above. No other file may be touched. No action file, no migration.
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.
- Follow the Phone section of `src/DESIGN.md`.

Already in the app from earlier prompts. **Use them; do not create, edit or redefine them:**
- `src/app/lib/useIsPhone.ts` exports the hook `useIsPhone(): boolean` (a named export).
- `src/tailwind.config.js` has a screen named `phone`, so a class written `phone:px-4` applies
  only on a phone-sized screen. Do not replace any `phone:` class below with `sm:`, `md:`,
  `max-md:` or any other variant.
- `src/app/components/mobile/MobileRow.tsx` (default export): one row of a phone list.
- `src/app/pages/attendance/AttendancePanel.tsx`: the employee panel. It is opened exactly as
  today (`setPanelEmail`); it is not edited.

If `src/app/components/mobile/MobileRow.tsx` or `src/app/lib/useIsPhone.ts` does not exist, stop
and say so. Do not write them.

No data is loaded differently: no new loader, no new query. The rows are built from the very
list the table is given (`empStats`), filtered by the same search and ordered by the same rule.


## 1. New file `src/app/lib/attendanceSort.ts` — the whole file

```ts
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
```

The only import is `import type`. Keep it that way: the tests load this file directly.


## 3. `src/app/pages/attendance/AttendanceTable.tsx`: steps 3a to 3d, nothing else

Every column, header, tooltip, class string, the `SortIcon`, the `PctBar`, `handleSort`, the two
`useState` lines and the box with `style={{ maxHeight: 'calc(100vh - 220px)' }}` stay exactly as
they are, byte for byte. A phone never renders this file's table, so that box is not used there.

**3a.** The imports. Replace

```tsx
import InfoTip from '@/app/components/InfoTip';

type SortKey = keyof EmpStats | 'reporting';
```

with

```tsx
import InfoTip from '@/app/components/InfoTip';
import { filterByName, sortEmployeeStats } from '@/app/lib/attendanceSort';
import type { SortKey } from '@/app/lib/attendanceSort';
```

**3b.** The Status pill and its sentence become importable: the one word `export` is added twice,
nothing else. Replace

```tsx
const STATUS_TOOLTIP = 'Based on on-time rate alone: Good is 90% or above, Fair is 75–89%, At Risk is below 75%.';

function StatusBadge({ pct, days }: { pct: number; days: number }) {
```

with

```tsx
export const STATUS_TOOLTIP = 'Based on on-time rate alone: Good is 90% or above, Fair is 75–89%, At Risk is below 75%.';

export function StatusBadge({ pct, days }: { pct: number; days: number }) {
```

**3c.** The Reporting pill and its sentence become importable the same way, and `reportingRatio`
leaves this file (it now lives in `attendanceSort.ts`). Replace

```tsx
const REPORTING_TOOLTIP = 'Of the days that needed an explanation — late or absent — how many had a GAF Attendance form on file.';

/** Ratio for sorting: -1 means needed=0 (always last in both directions) */
function reportingRatio(s: EmpStats): number {
  if (s.filing.needed === 0) return -1;
  return s.filing.filed / s.filing.needed;
}

function ReportingBadge({ s }: { s: EmpStats }) {
```

with

```tsx
export const REPORTING_TOOLTIP = 'Of the days that needed an explanation — late or absent — how many had a GAF Attendance form on file.';

export function ReportingBadge({ s }: { s: EmpStats }) {
```

**3d.** The table orders its rows with the shared rule. Replace

```tsx
  const filtered = stats.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
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
  });
```

with

```tsx
  const sorted = sortEmployeeStats(filterByName(stats, search), sortKey, sortDir);
```

Inside `StatusBadge` and `ReportingBadge` nothing changes: not a class, not a threshold.


## Acceptance

1. `attendanceSort.ts` exists with exactly the content above, and `AttendanceTable.tsx` has exactly steps 3a to 3d.
2. On a computer (1440 wide, mouse), Attendance → List: click each column header once and then again. For every column the rows are in exactly the same order as before this change, in both directions. Reporting still keeps people with nothing to report at the bottom both ways.
3. The Good / Fair / At Risk and Reporting pills and their mouse-over notes are as before. A phone still shows the table, as before.
4. No console errors.

When done, reply with a one-line summary per file.
