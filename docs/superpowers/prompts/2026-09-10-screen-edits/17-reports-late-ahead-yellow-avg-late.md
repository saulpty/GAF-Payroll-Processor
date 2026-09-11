# 17 — Reports: "Late — reported ahead" is amber, and an "Avg min late" chip

Saul: a late day is still a late day, even when the form came in ahead of the
shift, so it must not read green. And the summary strip should say how late
people are on average.

## Files you may change

- `src/app/pages/attendance/AttendanceReportTable.tsx` — one map entry
- `src/app/pages/attendance/AttendanceReportStrips.tsx` — one map entry
- `src/app/pages/attendance/AttendanceReport.tsx` — the `kpis` memo and one chip

**No other file may be touched.** No change to `attendanceReport.ts`, the
verdict rules, or any count that exists today. Every number on screen today
stays identical; one number is added.

## 1. Colour

- `AttendanceReportTable.tsx`: `late_reported_on_time` uses
  `'bg-amber-100 text-amber-700'` (the same as `late_reported_late`).
- `AttendanceReportStrips.tsx`: `late_reported_on_time` maps to `'warning'`
  (the same as `late_reported_late`).

`absent_reported_on_time` stays green in both files.

## 2. Average minutes late

In `AttendanceReport.tsx`, inside the `kpis` memo, add:

```ts
const lateRows   = scored.filter(r => r.verdict.startsWith('late'));
const avgLate    = lateRows.length > 0
  ? Math.round(lateRows.reduce((s, r) => s + (r.minutesLate ?? 0), 0) / lateRows.length)
  : null;
```

and return `avgLate` with the rest. In the strip, immediately **before** the
`{kpis.pct !== null ? … }` block, render:

```tsx
{kpis.avgLate !== null && (
  <KpiChip label="Avg min late" value={String(kpis.avgLate)} color="amber"
    tooltip="Average minutes late across the late days above (reported or not). Absences are not included." />
)}
```

(`KpiChip` already accepts `tooltip`.) The `ml-auto` on the percentage stays
so it still sits at the right.

## Verify

- `/attendance/reports`, Table view: "Late — reported ahead" chips are amber;
  Cards view: the same days are amber strips. "Absent — reported ahead" is
  still green.
- The strip reads `… Unexplained · Avg min late N · NN% on-time`. With
  Marcela Gordon's team over 2 periods (79 late days) N is a whole number.
- Only the three files changed. Confirm every identifier used is imported.
