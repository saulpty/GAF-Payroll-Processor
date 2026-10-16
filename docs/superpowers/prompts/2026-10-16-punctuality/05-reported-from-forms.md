# Attendance: "Reported" means a form is on file, on the List and the employee panel too

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only these files may change.** Two new: `src/app/lib/formReporting.ts`,
`src/app/pages/attendance/useFormReported.ts`. Three edited: `src/app/pages/Attendance.tsx`,
`src/app/pages/attendance/useEmployeeStats.ts`, `src/app/lib/attendanceStats.ts`. **No other file
may be touched.** No migration, no action file, no view. Nothing about pay changes.

Rules that hold for this prompt:

- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- Every file stays under 15 KB. `useLoadAction` parameters are passed flat, never `{ params: … }`.
- Dates are `YYYY-MM-DD` strings and are compared as strings. Never `new Date(str)` for date math.

## Why (found 2026-10-16)

Two sources answered "was this late day reported?":

- **Reports and the Why tags** read the attendance forms (`monday_attendance_forms`).
- **The List and the employee panel** read payroll's `documentation` field (`filed_gaf` in
  `v_attendance_daily`), a snapshot taken when the period was processed. It misses forms filed after
  payroll ran and forms the engine could not match then (the 2026-09-08 email-mismatch finding).

Measured on /dev, Sep 1 – Oct 15: the same 462 late days; Reports says 221 reported, the List 196.
25 days across 12 people have a form on file but showed as not reported (Arelis Acosta 10 vs 1,
Nichole Harris 4 vs 0). Absences: 2 with a form, the List said 0.

The fix: the List and the panel take "reported" from the forms too: a form for that person on that
date, the same rule Reports and the Why tags use. Payroll's own field is not changed.

## 1. New file `src/app/lib/formReporting.ts`

```ts
// "Reported" means one thing everywhere (2026-10-16): an attendance form on file for that person on
// that day, the rule Reports and the Why tags use. Payroll's own mark (filed_gaf) is a snapshot from
// when the period was processed and misses forms filed or matched later. Pure: no runtime imports.

import type { AttendanceRow } from './attendanceStats';
import type { ReportForm } from './attendanceReportTypes';

const LATE = ['Late - Reported', 'Late - Unreported'];
const ABSENT = 'Absent - Unexplained';

/**
 * Late and absent rows get `filed_gaf` (and a late row its status) from the forms; every other row
 * is returned unchanged, and so is a row whose email has no employee id.
 */
export function reportedFromForms(
  rows: AttendanceRow[], forms: ReportForm[], idByEmail: Map<string, number>,
): AttendanceRow[] {
  const filed = new Set<string>();
  for (const f of forms ?? []) {
    if (f.employee_id == null) continue;
    const day = String(f.form_date ?? '').slice(0, 10);
    if (day) filed.add(`${Number(f.employee_id)}|${day}`);
  }
  return (rows ?? []).map(r => {
    const late = LATE.indexOf(r.status) >= 0;
    if (!late && r.status !== ABSENT) return r;
    const id = idByEmail.get(String(r.email ?? '').trim().toLowerCase());
    if (id === undefined) return r;
    const has = filed.has(`${id}|${String(r.date).slice(0, 10)}`);
    return late
      ? { ...r, status: has ? 'Late - Reported' : 'Late - Unreported', filed_gaf: has }
      : { ...r, filed_gaf: has };
  });
}

/** email (trimmed, lower case) -> employee id, from the attendance employee list. */
export function idsByEmail(employees: { email: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of employees ?? []) {
    const id = Number((e as { id?: number }).id);
    const email = String(e.email ?? '').trim().toLowerCase();
    if (email && Number.isFinite(id)) m.set(email, id);
  }
  return m;
}
```

## 2. New file `src/app/pages/attendance/useFormReported.ts`

```ts
import { useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import loadMondayAttendanceFormsRangeAction from '@/actions/loadMondayAttendanceFormsRange';
import type { AttendanceRow } from '@/app/lib/attendanceStats';
import type { ReportForm } from '@/app/lib/attendanceReportTypes';
import { reportedFromForms, idsByEmail } from '@/app/lib/formReporting';

/**
 * Payroll rows with "reported" taken from the attendance forms for [dateFrom, dateTo], so the List,
 * the employee panel, Reports and the Why tags agree (2026-10-16). If the forms cannot be loaded the
 * rows keep payroll's own mark and `error` is true.
 */
export function useFormReported({ rows, employees, dateFrom, dateTo, viewAs }: {
  rows: AttendanceRow[]; employees: { email: string }[];
  dateFrom: string; dateTo: string; viewAs: string;
}): { rows: AttendanceRow[]; loading: boolean; error: boolean } {
  const [rawForms, loading, err] = useLoadAction(
    loadMondayAttendanceFormsRangeAction, [] as ReportForm[],
    { dateFrom, dateTo, manager: '', viewAs },
  );
  const idByEmail = useMemo(() => idsByEmail(employees ?? []), [employees]);
  const out = useMemo(
    () => (loading || err ? rows : reportedFromForms(rows, (rawForms as ReportForm[]) ?? [], idByEmail)),
    [rows, rawForms, idByEmail, loading, err],
  );
  return { rows: out, loading, error: !!err };
}
```

## 3. `src/app/pages/Attendance.tsx` — three edits, nothing else

**3a.** Replace

```tsx
import { useLiveListRows } from '@/app/pages/attendance/useLiveListRows';
```

with

```tsx
import { useLiveListRows } from '@/app/pages/attendance/useLiveListRows';
import { useFormReported } from '@/app/pages/attendance/useFormReported';
```

**3b.** Replace

```tsx
  const allRows = useMemo(
    () => (live.rows.length > 0 ? [...rows, ...live.rows] : rows),
    [rows, live.rows],
  );
```

with

```tsx
  // "Reported" = a form on file for that person and day, as on Reports (2026-10-16).
  const reported = useFormReported({ rows, employees: emps, dateFrom: safeFrom, dateTo: safeTo, viewAs });
  const allRows = useMemo(
    () => (live.rows.length > 0 ? [...reported.rows, ...live.rows] : reported.rows),
    [reported.rows, live.rows],
  );
```

**3c.** Replace

```tsx
  const loading = loadingRows || loadingEmps || live.loading;
```

with

```tsx
  const loading = loadingRows || loadingEmps || live.loading || reported.loading;
```

## 4. `src/app/pages/attendance/useEmployeeStats.ts` — four edits, nothing else

**4a.** Replace

```ts
import { useLiveListRows } from './useLiveListRows';
```

with

```ts
import { useLiveListRows } from './useLiveListRows';
import { useFormReported } from './useFormReported';
```

**4b.** Replace

```ts
  const loading = loadingEmps || loadingRows || live.loading;
```

with

```ts
  // "Reported" = a form on file for that person and day, as on Reports (2026-10-16).
  const reported = useFormReported({ rows, employees: oneEmp, dateFrom, dateTo, viewAs });

  const loading = loadingEmps || loadingRows || live.loading || reported.loading;
```

**4c.** Replace

```ts
    if (live.loading) return null;

    const allRows = live.rows.length > 0 ? [...rows, ...live.rows] : rows;
```

with

```ts
    if (live.loading || reported.loading) return null;

    const allRows = live.rows.length > 0 ? [...reported.rows, ...live.rows] : reported.rows;
```

**4d.** Replace

```ts
  }, [rows, live.rows, live.loading, emps, resolvedEmail]);
```

with

```ts
  }, [reported.rows, reported.loading, live.rows, live.loading, emps, resolvedEmail]);
```

## 5. `src/app/lib/attendanceStats.ts` — one edit, nothing else

Replace

```ts
  // List only knows unexplained absences, so every absence here is unreported
  const reported      = lateReported;
  const unreported    = lateUnreported + absent;
```

with

```ts
  // An absence is reported when a form is on file (filed_gaf, from the forms since 2026-10-16).
  const absentFiled   = active.filter(r => isAbsent(r.status) && r.filed_gaf).length;
  const reported      = lateReported + absentFiled;
  const unreported    = lateUnreported + absent - absentFiled;
```

## Acceptance — visible facts (on /dev, after a hard refresh)

1. Attendance → List, Dates 09/01/2026 → 10/15/2026: the Late Days card reads **221 Reported ·
   241 Not** (it read 196 · 266), the same as Reports for those dates. Absent Days reads **2 Reported
   · 8 Not**.
2. Arelis Acosta's row: under Late, **1 Not Reported** (it read 10).
3. Nichole Harris's panel (from List or Activity), Oct 2 – Oct 16: **Unreported 0**, matching her
   Why tags (every late day says Tardiness).
4. No number other than Reported / Unreported / Reporting changes: On-Time Rate, Late Days, Absent
   Days, Avg Min Late and Time Off stay as they were.
