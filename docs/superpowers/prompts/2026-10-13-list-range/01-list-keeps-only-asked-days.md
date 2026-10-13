# Attendance → List: the cards and table show only the days that were asked for

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only these files may change.** Two edited: `src/app/lib/attendanceStats.ts`,
`src/app/pages/Attendance.tsx`. **No other file may be touched.** No migration, no action file.

Rules that hold for this prompt:

- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.
- Dates are `YYYY-MM-DD` strings and are compared as strings. Never `new Date(str)` for date math.

## Why (found 2026-10-13, also on the live app)

Fresh load of Contracts, click Attendance, click List: the bar says `Q2-Oct-2026 · 10-11 → 10-13`
but the cards read `526 of 854 Expected`, about 30 days. Loading List directly reads `62 of 76`.

On arrival the page asks twice, a few milliseconds apart: first for its 30-day fallback (no dates
chosen yet), then for the period the filter bar picks. Measured on /dev: the 30-day answer came
back 218 ms **after** the 3-day one, and the later answer wins. The page then counts 30 days under
a 3-day label and never asks again.

The fix keeps only the days inside the range the page is showing, so a late answer for a wider
range cannot add days to it.

## 1. `src/app/lib/attendanceStats.ts` — one edit, nothing else

Replace

```ts
export function isExcluded(status: string) {
```

with

```ts
/**
 * Rows whose day is inside [from, to] (YYYY-MM-DD, compared as strings). A slower answer for an
 * earlier, wider range can arrive after the answer for the range now shown; this drops its extra days.
 */
export function rowsInRange<T extends { date: string }>(rows: T[], from: string, to: string): T[] {
  return rows.filter(r => {
    const day = String(r.date).slice(0, 10);
    return day >= from && day <= to;
  });
}

export function isExcluded(status: string) {
```

The new function goes directly above `isExcluded`, which itself does not change.

## 2. `src/app/pages/Attendance.tsx` — two edits, nothing else

**2a.** Replace

```tsx
  AttendanceRow, EmpInfo, computeEmployeeStats, computeCompanyKpis,
```

with

```tsx
  AttendanceRow, EmpInfo, computeEmployeeStats, computeCompanyKpis, rowsInRange,
```

**2b.** Replace

```tsx
  const rows = (rawRows as AttendanceRow[]) ?? [];
```

with

```tsx
  // The 30-day fallback's answer can land after the chosen period's: keep only the days shown.
  const rows = useMemo(
    () => rowsInRange((rawRows as AttendanceRow[]) ?? [], safeFrom, safeTo),
    [rawRows, safeFrom, safeTo],
  );
```

`useMemo` is already imported. The loaders, their parameters and everything else stay as they are.

## Acceptance — visible facts

1. Load Contracts fresh, click Attendance, click List: the cards agree with the period in the bar
   (for `Q2-Oct-2026`, On-Time Rate reads `… of 76 Expected` on 2026-10-13, not `… of 854`).
2. Load Attendance → List directly: the same numbers as in 1.
3. Switch to Dates and pick Last 30 Days: the cards grow to the 30-day numbers. Back to Periods:
   they return to the period's numbers.
4. No console errors.

When done, reply with a one-line summary per file.
