# 02 — Show the selected periods' from → to dates next to the Periods dropdown

## Files that may change

- `src/app/FilterBar.tsx`

No other file may be touched. Do not create, delete, rename or reformat
anything else. In particular do NOT edit `PeriodMultiSelect.tsx` or
`GlobalFilterContext.tsx`.

## Why

On `/attendance` and `/attendance/reports` the top bar has a Periods
multi-select that only shows the period name (or "2 periods"). Saul wants the
actual date range of the selection shown right next to it.

The range already exists. Selecting periods calls
`setAttendancePeriods(names, rangeOf(names))`, which puts the earliest start in
`dateFrom` and the latest end in `dateTo`.

Timezone invariant: dates are `YYYY-MM-DD` strings. Display them with
`fmtDate` from `@/app/lib/fmtDate`, which splits the string. Never construct a
`Date` from them and never call `toISOString()`.

## The change

1. Add the import:
   ```ts
   import { fmtDate } from '@/app/lib/fmtDate';
   ```
2. In the `{cfg.periods && (...)}` block, directly after the closing
   `/>` of `<PeriodMultiSelect ... />`, and before the divider line, insert:
   ```tsx
   {attendancePeriods.length > 0 && dateFrom && dateTo && (
     <span className="text-[12px] text-slate-500 tabular-nums whitespace-nowrap">
       {fmtDate(dateFrom)} → {fmtDate(dateTo)}
     </span>
   )}
   ```

Nothing else in `FilterBar.tsx` changes.

## Acceptance criteria

- On `/attendance`, with one period selected, the bar reads e.g.
  `Periods [Q1-Jun-2026 ▾] 06-01-2026 → 06-15-2026`.
- With two periods selected, the range runs from the earlier period's start to
  the later period's end.
- With no periods selected, no dates are shown.
- `/pto`, `/action-required`, `/payroll-master` and `/process` look exactly
  as before.
- Only `src/app/FilterBar.tsx` changed.
