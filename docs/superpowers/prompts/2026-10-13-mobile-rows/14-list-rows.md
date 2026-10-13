# Phone view, Attendance → List: rows instead of the table

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today Attendance → List is the computer's 17-column table inside a box that slides
sideways, and the only way to change the order is to tap a column header that is usually off the
screen. This prompt gives a phone-sized screen one row per employee (name, role, the Good / Fair /
At Risk pill, then % on time, Late, Unreported, Absent and the Reporting pill) with one "Sort By"
box above them. Tapping a row opens the employee panel, exactly as a click on a table row does.
The table's ordering rule moves, unchanged, into one small file that both the table and the rows
use. A computer keeps exactly what it has, including the order of the rows for every column.

**Only these files may change.** Two new: `src/app/lib/attendanceSort.ts`,
`src/app/pages/attendance/AttendanceListRows.tsx`. Three edited:
`src/app/pages/attendance/AttendanceTable.tsx`, `src/app/pages/Attendance.tsx`,
`src/app/pages/attendance/AttendanceKpis.tsx`. **No other file may be touched.** No migration, no
action file.

Rules:
- Only these files may change: the five listed above. No other file may be touched. No action file, no migration.
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

## 2. New file `src/app/pages/attendance/AttendanceListRows.tsx` — the whole file

```tsx
import { useState } from 'react';
import type { EmpStats } from '@/app/lib/attendanceStats';
import {
  PHONE_SORTS, filterByName, listNothingFound, phoneSort, sortEmployeeStats,
} from '@/app/lib/attendanceSort';
import MobileRow from '@/app/components/mobile/MobileRow';
import { REPORTING_TOOLTIP, ReportingBadge, STATUS_TOOLTIP, StatusBadge } from './AttendanceTable';

// Attendance → List on a phone: one row per employee, built from the same list, the same search
// and the same ordering rule as AttendanceTable. The page renders this OR the table, never both.
// The Good / Fair / At Risk pill and the Reporting pill are the table's own, imported.

type Props = {
  stats: EmpStats[];
  /** Opens the employee panel: the same callback a click on a table row calls. */
  onRowClick: (email: string) => void;
  /** The employee search box. */
  search: string;
  /** The Manager and Title filters, only to name them when nobody matches. */
  manager?: string;
  role?: string;
};

// The page has 16px side padding; a phone list runs edge to edge.
const LIST = '-mx-4 bg-white border-t border-slate-200';

/** Grey placeholder rows at the real row height, shown while the page is loading. */
export function AttendanceListLoading() {
  return (
    <div className={LIST} role="status" aria-label="Loading attendance data">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="h-[60px] border-b border-slate-200 bg-white animate-pulse px-4 py-3">
          <div className="h-3.5 w-40 rounded bg-slate-200" />
          <div className="mt-2.5 h-3 w-56 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function AttendanceListRows({ stats, onRowClick, search, manager, role }: Props) {
  const [sortKey, setSortKey] = useState<string>(PHONE_SORTS[0].key);
  const sort = phoneSort(sortKey);
  const sorted = sortEmployeeStats(filterByName(stats, search), sort.key, sort.dir);

  return (
    <div>
      <label className="flex items-center gap-3 text-[13px] font-medium text-slate-600">
        <span className="shrink-0">Sort By</span>
        <select
          value={sort.key}
          onChange={e => setSortKey(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
        >
          {PHONE_SORTS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>

      {/* On a computer these two sentences are mouse-over notes on the column headers. */}
      <details className="mb-1 text-[12px] leading-4 text-slate-500">
        <summary className="cursor-pointer py-3.5 font-medium text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring">
          What Status and Reporting Mean
        </summary>
        <p className="pb-1"><span className="font-medium text-slate-700">Status.</span> {STATUS_TOOLTIP}</p>
        <p className="pb-3"><span className="font-medium text-slate-700">Reporting.</span> {REPORTING_TOOLTIP}</p>
      </details>

      {sorted.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          {listNothingFound({ employee: search, manager, role })}
        </div>
      ) : (
        <div className={LIST}>
          {sorted.map(s => (
            <MobileRow
              key={s.email}
              title={s.name}
              sub={s.role || undefined}
              right={<StatusBadge pct={s.pctOnTime} days={s.days} />}
              chevron="right"
              onClick={() => onRowClick(s.email)}
              facts={
                <>
                  <span><span className="font-medium text-slate-700">{s.pctOnTime.toFixed(0)}%</span> on time</span>
                  <span>Late {s.totalLate}</span>
                  <span>Unreported {s.unreported}</span>
                  <span>Absent {s.absent}</span>
                  <span className="inline-flex items-center gap-1.5">Reporting <ReportingBadge s={s} /></span>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

Everything passed into `MobileRow` is a `<span>` or text (the row is a button; a button may not
hold a `<div>`). Do not add the on-time bar (`PctBar`): it is made of `<div>`s.

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

## 4. `src/app/pages/Attendance.tsx`: steps 4a to 4f, nothing else

Every loader, every `useMemo`, `rowsInRange`, `useLiveListRows`, the cards, the
"Employee Directory" line and the `<AttendancePanel … />` block stay exactly as they are.

**4a.** Directly after the line `import { AttendanceTable }  from '@/app/pages/attendance/AttendanceTable';` add:

```tsx
import AttendanceListRows, { AttendanceListLoading } from '@/app/pages/attendance/AttendanceListRows';
import { useIsPhone } from '@/app/lib/useIsPhone';
```

**4b.** Inside `AttendanceInner`, directly after the line `  const { viewAs } = useViewer();` add:

```tsx
  const isPhone = useIsPhone();
```

This is the page's one `useIsPhone()` call. Do not call it anywhere else in these five files.

**4c.** The page's outer box. Replace

```tsx
    <div className="flex flex-col h-full bg-background">
```

with

```tsx
    <div className="flex flex-col h-full bg-background phone:h-auto phone:min-h-full">
```

**4d.** The page area. On a phone it stops scrolling by itself, so the whole page scrolls as one.
Replace

```tsx
      <div className="flex-1 overflow-auto px-4 py-4 w-full">
```

with

```tsx
      <div className="flex-1 overflow-auto px-4 py-4 w-full phone:flex-none phone:overflow-visible">
```

**4e.** Loading. Replace

```tsx
          {loading && (
            <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
```

with

```tsx
          {loading && isPhone && <AttendanceListLoading />}
          {loading && !isPhone && (
            <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
```

**4f.** Rows on a phone, the table on a computer: one or the other, never both. Replace

```tsx
                <AttendanceTable stats={empStats} onRowClick={setPanelEmail} search={globalEmployee} />
```

with

```tsx
                {isPhone
                  ? <AttendanceListRows stats={empStats} onRowClick={setPanelEmail} search={globalEmployee} manager={manager} role={role} />
                  : <AttendanceTable stats={empStats} onRowClick={setPanelEmail} search={globalEmployee} />}
```

The red "Error loading data…" box stays where it is and shows on a phone as it does on a computer.

## 5. `src/app/pages/attendance/AttendanceKpis.tsx`: one edit, a class string only

On a phone the ten cards are already two across, but the small grey line under each number is cut
off with "…" ("Late/Absent, Form Fil…"). It may wrap instead. Replace

```tsx
      {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
```

with

```tsx
      {sub && <div className="text-[11px] text-muted-foreground truncate phone:whitespace-normal phone:text-xs">{sub}</div>}
```

Every `<Kpi … />`, every `tooltip`, the grid classes (`grid-cols-2 sm:grid-cols-5 xl:grid-cols-10`)
and the check line under the cards stay exactly as they are.

## Known and accepted

- The cards' explanations (what "On-Time Rate" counts, and so on) are mouse-over notes
  (`title`). A phone cannot show them. They are left as they are in this prompt.
- The Status pill and the Reporting pill are the table's own and keep their 11 px text on a phone
  (the phone guide says 12). They are imported unchanged so the two layouts can never disagree.
- The Status pill keeps its own keyboard stop inside the row. A phone has no keyboard; a tap
  anywhere on the row opens the panel.
- The phone row leaves out Manager, Schedule, Expected, On Time, Reported, Avg Min and the three
  lateness bands. They are in the employee panel.
- The "Sort By" box has one fixed direction per choice. Someone with no expected days in the
  range shows 0% and so comes first under "% On-Time (Lowest First)", as on a computer when that
  column is clicked.
- The phone's order and the computer's order are kept separately: turning a phone to a computer
  width starts the table in its usual Name order.

## Acceptance — visible facts

On a phone-sized screen (375 × 667), Attendance → List:
1. The ten cards sit two across. The small grey line under each number is whole, on one or two
   lines (`Late/Absent, Form Filed`), never cut with "…".
2. Under "Employee Directory · N employees": a `Sort By` box 44 px tall, then
   `What Status and Reporting Mean` (tap it: two short sentences open; tap again: they close).
3. No table. One row per employee, edge to edge, a hairline between rows. Line 1: the name in
   bold, the role under it, and at the right the `Good`, `Fair` or `At Risk` pill and a `›`.
   Line 2: `92% on time`, `Late 3`, `Unreported 1`, `Absent 0`, `Reporting Complete 3/3` (or
   `Gaps`, `Rarely`, or a dash). The numbers and pills match the same person's row on a computer
   for the same dates.
4. The rows start in name order, A to Z, the same order as the computer's table.
5. Choose `% On-Time (Lowest First)`: the lowest percentage is at the top. `Unreported (Most
   First)`, `Absent (Most First)`, `Total Late (Most First)`: the largest number is at the top.
   `Name (A to Z)` puts the names back.
6. Tap a row: the employee panel opens for that person. Close it: the list is where it was, in
   the order chosen.
7. A long name wraps onto a second line; the pill stays at the right. Nothing is cut with "…".
8. With a Manager, Title or employee search that matches nobody: one centred line that names it,
   such as `No employees match Title: Intake 1`.
9. While loading, five grey placeholder rows show instead of a blank page.
10. The page scrolls as one; no list scrolls inside a box. Sideways (667 × 375) it is the same
    layout. No console errors on load or after each tap.

On a computer nothing changes (1440 wide, mouse):
11. The cards are ten across with the same text; the table has its 17 columns inside its own
    scrolling box with the headers staying put.
12. Click each column header once and then again: for every column the rows are in exactly the
    same order as before this change, in both directions. Reporting still keeps people with
    nothing to report at the bottom both ways.
13. The Good / Fair / At Risk and Reporting pills, their mouse-over notes, and a click on a row
    opening the side panel are all as before. Loading shows "Loading attendance data…"; no match
    shows "No employees match these filters."

When done, reply with a one-line summary per file.
