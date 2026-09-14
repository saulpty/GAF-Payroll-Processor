# 01 — Attendance List and Reports show the same ten top cards

## Files that may change

- `src/app/lib/attendanceStats.ts` (only `CompanyKpis` and `computeCompanyKpis`)
- `src/app/lib/reportKpis.ts` (new)
- `src/app/pages/attendance/AttendanceKpis.tsx`
- `src/app/pages/attendance/AttendanceReport.tsx`

No other file may be touched. Do not create, delete, rename or reformat
anything else. In particular do NOT edit `computeEmployeeStats`,
`AttendanceTable.tsx`, `AttendancePanel.tsx`, `AttendanceReportStrips.tsx`,
`AttendanceReportTable.tsx`, `attendanceReport.ts`, `Attendance.tsx`, or any
action.

## Why

The List tab (`/attendance`) shows 8 cards from `AttendanceKpis`. The Reports tab
(`/attendance/reports`) shows a different chip bar (`KpiChip`) with different
rules. Both tabs must show the same ten cards, in this order:

On-Time Rate · Late Rate · Work Days · Late Days · Avg Min Late · Absent Days ·
Reported · Unreported · Time Off · Permission

The "Days Expected" card is removed.

Rules (decided by Saul 2026-09-14):
- **Absent Days** = every absence, reported or not.
- **Avg Min Late** = minutes late averaged over **late days only**.
- **Work Days** = every scheduled shift day in range, including time off and permission.
- Expected days (not shown as a card) = on time + late + absent. Both rates divide by it.
- **Reported / Unreported** cover late AND absent days.

Timezone invariant: nothing here touches dates. Do not construct a `Date`.

## 1. `src/app/lib/attendanceStats.ts`

Replace ONLY the `CompanyKpis` type and the `computeCompanyKpis` function with
exactly this. Everything else in the file stays byte-for-byte the same.

```ts
export type CompanyKpis = {
  daysTracked: number;     // expected days = on time + late + absent (rate denominator)
  onTime: number;
  lateReported: number;
  lateUnreported: number;
  lateDays: number;        // lateReported + lateUnreported
  excused: number;         // "Time off"
  permission: number;
  absent: number;
  reported: number;        // late or absent days with a form
  unreported: number;      // late or absent days without a form
  totalRows: number;
  workDays: number;        // every scheduled shift day, incl. time off and permission
  avgMinLate: number;      // over late days only
  onTimeRate: number;
  lateRate: number;
};

export function computeCompanyKpis(rows: AttendanceRow[]): CompanyKpis {
  const active  = rows.filter(r => !isExcluded(r.status));
  const arrived = active.filter(r => !isAbsent(r.status));
  const onTime        = arrived.filter(r => r.status === 'On Time').length;
  const lateReported  = arrived.filter(r => r.status === 'Late - Reported').length;
  const lateUnreported = arrived.filter(r => r.status === 'Late - Unreported').length;
  const excused       = rows.filter(r => r.status === 'Excused (PTO/FH/Perm)').length;
  const permission    = rows.filter(r => r.status === 'Permission').length;
  const absent        = active.filter(r => isAbsent(r.status)).length;
  const lateRows      = arrived.filter(r => r.status === 'Late - Reported' || r.status === 'Late - Unreported');
  const sumLate       = lateRows.reduce((s, r) => s + r.minutes_late, 0);
  const lateDays      = lateReported + lateUnreported;
  const daysTracked   = active.length;   // expected (includes absent)
  const totalRows     = rows.length;
  const workDays      = totalRows;
  // List only knows unexplained absences, so every absence here is unreported
  const reported      = lateReported;
  const unreported    = lateUnreported + absent;
  const avgMinLate    = lateRows.length > 0 ? sumLate / lateRows.length : 0;
  const onTimeRate    = daysTracked > 0 ? (onTime / daysTracked) * 100 : 0;
  const lateRate      = daysTracked > 0 ? (lateDays / daysTracked) * 100 : 0;
  return {
    daysTracked, onTime, lateReported, lateUnreported, lateDays, excused, permission, absent,
    reported, unreported, totalRows, workDays, avgMinLate, onTimeRate, lateRate,
  };
}
```

## 2. `src/app/lib/reportKpis.ts` — create exactly this

```ts
// Type-only imports on purpose: node --test cannot resolve extension-less runtime imports.
import type { ReportRow } from './attendanceReportTypes';
import type { CompanyKpis } from './attendanceStats';

/**
 * Attendance Reports → the same ten top cards the List tab shows.
 * Absent = every absence verdict. Reported / Unreported cover late AND absent days.
 * Time off = pto + holiday. Work days = scored days + time off + permission.
 * not_processed rows are counted nowhere.
 */
export function reportRowsToKpis(rows: ReportRow[]): CompanyKpis {
  const count = (...verdicts: string[]) => rows.filter(r => verdicts.includes(r.verdict)).length;

  const onTime         = count('on_time');
  const lateReported   = count('late_reported_on_time', 'late_reported_late');
  const lateUnreported = count('late_no_form');
  const absentReported = count('absent_reported_on_time', 'absent_reported_late');
  const unexplained    = count('unexplained_absence');
  const excused        = count('pto', 'holiday');
  const permission     = count('permission');

  const lateDays    = lateReported + lateUnreported;
  const absent      = absentReported + unexplained;
  const daysTracked = onTime + lateDays + absent;
  const workDays    = daysTracked + excused + permission;

  const lateRows   = rows.filter(r => r.verdict.startsWith('late'));
  const sumLate    = lateRows.reduce((s, r) => s + (r.minutesLate ?? 0), 0);
  const avgMinLate = lateRows.length > 0 ? sumLate / lateRows.length : 0;
  const onTimeRate = daysTracked > 0 ? (onTime / daysTracked) * 100 : 0;
  const lateRate   = daysTracked > 0 ? (lateDays / daysTracked) * 100 : 0;

  return {
    daysTracked, onTime, lateReported, lateUnreported, lateDays,
    excused, permission, absent,
    reported: lateReported + absentReported,
    unreported: lateUnreported + unexplained,
    totalRows: workDays, workDays,
    avgMinLate, onTimeRate, lateRate,
  };
}
```

## 3. `src/app/pages/attendance/AttendanceKpis.tsx`

Keep the import, `Tone`, `Props` and the `Kpi` component exactly as they are.
Replace the whole `AttendanceKpis` function with exactly this:

```tsx
export function AttendanceKpis({ kpis }: Props) {
  const totalCheck = kpis.onTime + kpis.lateDays + kpis.absent + kpis.excused + kpis.permission;
  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-10 gap-2 mb-1">
        <Kpi
          label="On-Time Rate"
          value={`${kpis.onTimeRate.toFixed(1)}%`}
          sub={`${kpis.onTime} of ${kpis.daysTracked} expected`}
          tone="lead"
          color="text-secondary"
          tooltip="On-time days divided by expected days (on time + late + absent). Time off and permissions are not counted either way."
        />
        <Kpi
          label="Late Rate"
          value={`${kpis.lateRate.toFixed(1)}%`}
          sub={`${kpis.lateDays} of ${kpis.daysTracked} expected`}
          tone="alert"
          color="text-amber-600"
          tooltip="Late days divided by expected days (on time + late + absent)."
        />
        <Kpi
          label="Work Days"
          value={`${kpis.workDays}`}
          sub="scheduled shifts"
          tone="plain"
          tooltip="Every day someone was scheduled on their shift in this range, including time off and permissions."
        />
        <Kpi
          label="Late Days"
          value={`${kpis.lateDays}`}
          sub={`${kpis.lateReported} reported · ${kpis.lateUnreported} not`}
          tone="plain"
          tooltip="Days someone clocked in after their shift start."
        />
        <Kpi
          label="Avg Min Late"
          value={`${kpis.avgMinLate.toFixed(1)}m`}
          sub="per late day"
          tone="plain"
          tooltip="Average minutes late across the late days only. On-time days and absences are not included."
        />
        <Kpi
          label="Absent Days"
          value={`${kpis.absent}`}
          sub="reported or not"
          tone="alert"
          color="text-[#B91C1C]"
          tooltip="Scheduled to work with no clock-in and no time off or permission covering the day, whether or not a form was filed."
        />
        <Kpi
          label="Reported"
          value={`${kpis.reported}`}
          sub="late/absent, form filed"
          tone="plain"
          tooltip="Late or absent days with an attendance form on file."
        />
        <Kpi
          label="Unreported"
          value={`${kpis.unreported}`}
          sub="late/absent, no form"
          tone="alert"
          color="text-destructive"
          tooltip="Late or absent days with no attendance form on file."
        />
        <Kpi
          label="Time Off"
          value={`${kpis.excused}`}
          sub="PTO, holidays"
          tone="plain"
          tooltip="Approved days away: PTO, company holidays, birthday and compensatory days. These never affect the score."
        />
        <Kpi
          label="Permission"
          value={`${kpis.permission}`}
          sub="Approved"
          tone="plain"
          tooltip="An approved permission covered the day. Does not affect the score."
        />
      </div>
      <div className="text-[10px] text-muted-foreground px-1">
        On-Time ({kpis.onTime}) + Late ({kpis.lateDays}) + Absent ({kpis.absent}) + Time off ({kpis.excused}) + Permission ({kpis.permission}) = {totalCheck} = Work Days ({kpis.workDays})
      </div>
    </div>
  );
}
```

## 4. `src/app/pages/attendance/AttendanceReport.tsx`

1. Add these two imports next to the other `@/app/lib` / component imports:
   ```ts
   import { reportRowsToKpis } from '@/app/lib/reportKpis';
   import { AttendanceKpis } from './AttendanceKpis';
   ```
2. Replace the whole `// ── Summary strip KPIs` `useMemo` block with:
   ```ts
   const kpis = useMemo(() => reportRowsToKpis(rows), [rows]);
   ```
3. Replace the whole `{/* KPI bar */}` `<div>` (the white rounded bar holding the
   `KpiChip`s, the `% on-time` span and the Cards/Table toggle) with:
   ```tsx
   <AttendanceKpis kpis={kpis} />

   {/* View toggle */}
   <div className="flex justify-end mb-3">
     <div className="flex rounded-lg border border-border overflow-hidden shadow-sm">
       {/* the two existing Cards / Table <button>s, unchanged */}
     </div>
   </div>
   ```
   The two toggle buttons keep their exact current markup, classes and onClick.
4. Delete the `KpiChip` function at the bottom of the file. Remove any import that
   is now unused. Nothing else in the file changes: data loads, the
   `buildAttendanceReport` memo, the error/loading/empty states, the
   unmatched-forms notice, and the Strips/Table views.

## Acceptance criteria

- `/attendance` shows the ten cards in the order above, plus the footnote. It
  has no "Days Expected" card.
- `/attendance/reports` shows the same ten cards and footnote, with the
  Cards/Table toggle underneath on the right. Both views still switch.
- On both pages the footnote sum equals Work Days.
- The Employee Directory table and the side panel on `/attendance` show the
  same "Avg Min (worked)" numbers as before.
- Only the four files listed above changed.
