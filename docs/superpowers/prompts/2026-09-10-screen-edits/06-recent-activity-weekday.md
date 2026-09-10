# 06 — Viewer → Recent Activity: dates read "Thursday, September 8, 2026"

## Files you may change

- `src/app/lib/fmtDay.ts` — add one export
- `src/app/pages/attendance/AttendancePanel.tsx` — two small edits

**No other file may be touched.**

## fmtDay.ts

Add, next to `fmtDay`, using the same `parts`/`weekday` helpers and **no `Date`
object**:

```ts
const WD_LONG  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MON_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/** "Thursday, September 8, 2026". Accepts a YYYY-MM-DD string or a Postgres timestamp string. */
export function fmtDayLong(ymd: string | null | undefined): string {
  if (!ymd) return '';
  const p = parts(ymd);
  if (!p) return String(ymd);
  return `${WD_LONG[weekday(ymd)]}, ${MON_LONG[p[1] - 1]} ${p[2]}, ${p[0]}`;
}
```

A local test already pins it: `fmtDayLong('2026-09-08')` → `Tuesday, September 8, 2026`;
`fmtDayLong('2026-09-08T00:00:00.000Z')` → the same; `null` → `''`.

## AttendancePanel.tsx

1. Import `fmtDayLong` from `@/app/lib/fmtDay` and `toLocalYMD` from
   `@/app/lib/classificationEngine`.
2. In `toDateStr`, replace `val.toISOString().slice(0, 10)` with
   `toLocalYMD(val)` (the timezone invariant: no `toISOString` date slicing).
3. In the Recent Activity table, the date cell becomes
   `<td className="px-3 py-2 whitespace-nowrap">{fmtDayLong(toDateStr(r.date))}</td>`
   (drop `font-mono`). Sorting still uses `toDateStr`.

Nothing else in the panel changes.

## Verify

- Open any employee from the Attendance List: Recent Activity dates read like
  `Tuesday, September 8, 2026`, newest first.
- Only the two files changed. Confirm every identifier used is imported.
