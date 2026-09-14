# 03 — Reports takes time off and permission from payroll, with a quiet flag

## Files that may change

- `src/app/lib/attendanceReport.ts`
- `src/app/lib/attendanceReportTypes.ts`
- `src/app/pages/attendance/AttendanceReportStrips.tsx`
- `src/app/pages/attendance/AttendanceReportTable.tsx`

No other file may be touched. Do not create, delete, rename or reformat
anything else. In particular do NOT edit `classificationEngine.ts`, any action,
any migration, `AttendanceReport.tsx`, `AttendanceKpis.tsx`, `reportKpis.ts` or
`attendanceStats.ts`.

## Why

The Attendance **List** tab reads the label payroll wrote on each day
(`payroll_entries.event_type_1`, through `v_attendance_daily`). The **Reports**
tab ignores that label and decides time off / permission from Monday requests
only. When payroll and Monday disagree the two tabs show different Time Off,
Permission and Absent numbers for the same period (Q1-Sep-2026: List 52 / 11 / 3,
Reports 30 / 0 / 30).

Decision (Saul, 2026-09-14): **payroll's time-off and permission label wins.**
Monday requests are used only when payroll has not labelled the day. When payroll
excused a day but no Monday request covers it, the day carries a quiet flag
(an info icon), which changes no count.

Everything else Reports does stays exactly as it is: late / on-time from punches,
reported vs unreported and on-time form submission from Monday forms, holidays
from the holidays table, `not_processed`, and the existing flags. A payroll label
of `Ausencia Injustificada` is NOT time off — that day still goes through the
punches/forms logic, and the existing `recordedUnexplainedButFormOnFile` flag.

Timezone invariant: nothing here touches date math. Dates stay `YYYY-MM-DD`
strings compared as strings. Do not construct a `Date`.

`attendanceReport.ts` must keep **no runtime imports** (node --test loads it
directly). Do not add any import to it.

## 1. `src/app/lib/attendanceReport.ts`

### 1a. Constants

Directly after the `PTO_REQUEST_TYPES` set, add exactly:

```ts
// payroll_entries.event_type_1 labels — the same lists v_attendance_daily uses.
// 'Ausencia Justificada.' carries a trailing period in the data.
export const PAYROLL_TIME_OFF_EVENTS: string[] = [
  'PTO', 'Feriado', 'Compensatory Day', 'Birthday Day Off', 'Ausencia Justificada.',
];
export const PAYROLL_PERMISSION_EVENTS: string[] = [
  'Permiso Remunerado', 'Permiso No remunerado', 'Permission', 'Time Off',
];
```

### 1b. Verdict block

Inside `buildAttendanceReport`, replace everything from the line
`// Check holiday` down to and including the line `const multipleForms = allForms.length > 1;`
with exactly:

```ts
      // Payroll's own time-off / permission label wins, so Reports matches the
      // List tab (decided 2026-09-14). Monday requests are the fallback.
      const payrollEvent = (payrollRow?.event_type_1 ?? '').trim();
      const payrollTimeOff = PAYROLL_TIME_OFF_EVENTS.includes(payrollEvent);
      const payrollPermission = PAYROLL_PERMISSION_EVENTS.includes(payrollEvent);

      // Away requests — normalise to lowercase+trim so the matcher
      // agrees with classificationEngine.ts which also lowercases.
      const awayRequest = empRequests.find(r => {
        const rt = (r.request_type ?? '').trim().toLowerCase();
        if (PASSTHROUGH_REQUEST_TYPES.has(rt)) return false;
        if (!AWAY_REQUEST_TYPES.includes(rt)) return false;
        return requestCoversDate(r, date);
      });

      const holidayName = holidayMap.get(date);
      if (holidayName) {
        verdict = 'holiday';
        coveredBy = { kind: 'holiday', label: holidayName };
      } else if (payrollTimeOff || payrollPermission) {
        verdict = payrollPermission ? 'permission' : payrollEvent === 'Feriado' ? 'holiday' : 'pto';
        coveredBy = { kind: verdict as 'pto' | 'permission' | 'holiday', label: payrollEvent };
      } else if (awayRequest) {
        const rt = (awayRequest.request_type ?? '').trim().toLowerCase();
        verdict = PTO_REQUEST_TYPES.has(rt) ? 'pto' : 'permission';
        coveredBy = { kind: verdict as 'pto' | 'permission', label: awayRequest.request_type };
      } else if (!hasAnyPayroll || !dateInProcessedPeriod(date, periods)) {
        verdict = 'not_processed';
      } else if (payrollRow && payrollRow.entry_time != null) {
        // Has punches
        if (payrollRow.late_minutes > 0) {
          if (!form) verdict = 'late_no_form';
          else if (form.onTime) verdict = 'late_reported_on_time';
          else verdict = 'late_reported_late';
        } else {
          verdict = 'on_time';
        }
      } else {
        // No punches
        if (form) {
          verdict = form.onTime ? 'absent_reported_on_time' : 'absent_reported_late';
        } else {
          verdict = 'unexplained_absence';
        }
      }

      const countsToScore = SCORED_VERDICTS.includes(verdict);

      // Flags
      const excusedInPayrollNoRequest =
        !holidayName && payrollEvent !== 'Feriado' && (payrollTimeOff || payrollPermission) && !awayRequest;
      const multipleForms = allForms.length > 1;
```

### 1c. Row flags

In the `rows.push({ ... })` call, change the `flags` line to exactly:

```ts
        flags: { multipleForms, recordedUnexplainedButFormOnFile, formEmailUnrecognised, excusedInPayrollNoRequest },
```

Nothing else in this file changes.

## 2. `src/app/lib/attendanceReportTypes.ts`

In `ReportRow.flags`, after `formEmailUnrecognised: boolean;`, add:

```ts
    /** payroll labelled the day time off / permission, but no Monday request covers it */
    excusedInPayrollNoRequest: boolean;
```

Nothing else in this file changes.

## 3. `src/app/pages/attendance/AttendanceReportStrips.tsx`

In `DayTile`, replace the top-right info-icon block (the one whose condition is
`row.flags.recordedUnexplainedButFormOnFile || row.flags.formEmailUnrecognised`)
with exactly:

```tsx
      {(row.flags.recordedUnexplainedButFormOnFile || row.flags.formEmailUnrecognised || row.flags.excusedInPayrollNoRequest) && (
        <span className="absolute top-1 right-1">
          <Info className="w-3 h-3 text-slate-400" title={
            row.flags.recordedUnexplainedButFormOnFile
              ? 'Recorded as an unjustified absence even though a form was filed.'
              : row.flags.formEmailUnrecognised
                ? 'Form submitted by a different email'
                : 'Excused in payroll — no Monday request found'
          } />
        </span>
      )}
```

Nothing else in this file changes.

## 4. `src/app/pages/attendance/AttendanceReportTable.tsx`

In the verdict cell, directly after the existing
`{r.flags.formEmailUnrecognised && ( ... )}` block, add:

```tsx
                    {r.flags.excusedInPayrollNoRequest && (
                      <Info className="w-3 h-3 inline ml-1 text-slate-400"
                        title="Excused in payroll — no Monday request found" />
                    )}
```

Nothing else in this file changes.

## Acceptance criteria

- On `/attendance/reports` for Q1-Sep-2026, the Time Off, Permission and Absent
  Days cards equal (or come very close to) the same cards on `/attendance`.
- A day payroll labelled PTO / permission with no Monday request shows the grey
  info icon, whose tooltip reads "Excused in payroll — no Monday request found".
- Late, on-time, reported / unreported and the Cards/Table toggle behave as before.
- Only the four files listed above changed.
