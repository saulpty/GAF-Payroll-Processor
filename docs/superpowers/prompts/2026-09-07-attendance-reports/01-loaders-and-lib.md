# Attendance Reports — data loaders and the verdict module

Build the data layer for a new **Reports** tab under Attendance. No UI in this
prompt: no page, no component, no route, no nav entry.

## Files you may change — and no others

Create:
- `src/actions/loadAttendanceReportDays.ts`
- `src/actions/loadMondayAttendanceFormsRange.ts`
- `src/actions/loadMondayRequestsRange.ts`
- `src/app/lib/attendanceReport.ts`

Modify:
- `src/actions/loadAttendanceEmployees.ts` — **additively only** (extra columns;
  every existing column keeps its name and position).

**No other file may be touched.** Not `AGENTS.md`, not a page, not a component,
not a migration, not `classificationEngine.ts`, not `attendanceStats.ts`.

## Context

A manager needs to see, per employee per day: the punches, the minutes late, the
Absence/Tardiness form behind that day, and whether that form was submitted
**before the shift started** — company policy says it must be. Days nobody
explained must be visible too.

The verdict is computed in the app, in a pure module, not in SQL. These facts
were measured against the live database and are not assumptions:

- `monday_attendance_forms.submitted_at` is **Eastern wall clock**, format
  `"YYYY-MM-DD HH:MM"` (e.g. `"2026-09-02 09:03"`). It compares directly to
  `scheduled_start` (`"9:00 AM"`) with **no timezone conversion**.
- The away window is `start_date <= day < return_date`. When `return_date` is
  null, `end_date` is inclusive.
- `start_datetime` / `end_datetime` on requests are always empty — there is no
  partial-day permission data.
- Tardiness forms carry **no reason** (the column is blank on all 1,164).
- All 45 active employees have a schedule, a manager and a start date.

## 1. `src/actions/loadAttendanceReportDays.ts`

Punch data straight from `payroll_entries` — **not** from `v_attendance_daily`,
which drops days with no punches and is therefore blind to absences.

```sql
SELECT DISTINCT ON (pe.employee_id, LEFT(pe.work_date, 10))
       pe.employee_id,
       LEFT(pe.work_date, 10)                       AS work_date,
       NULLIF(TRIM(pe.entry_time), '')              AS entry_time,
       NULLIF(TRIM(pe.exit_time), '')               AS exit_time,
       NULLIF(TRIM(pe.scheduled_start), '')         AS scheduled_start,
       GREATEST(0, COALESCE(pe.late_minutes, 0))    AS late_minutes,
       GREATEST(0, COALESCE(pe.early_leave_minutes, 0)) AS early_leave_minutes,
       COALESCE(pe.event_type_1, '')                AS event_type_1,
       COALESCE(pe.documentation, '')               AS documentation,
       COALESCE(pe.auto_notes, '')                  AS auto_notes,
       pe.period_name
FROM public.payroll_entries pe
JOIN public.employees e ON e.id = pe.employee_id
WHERE pe.deleted_at IS NULL
  AND LEFT(pe.work_date, 10) >= {{params.dateFrom}}
  AND LEFT(pe.work_date, 10) <= {{params.dateTo}}
  AND e.active = true
  AND COALESCE(e.excluded_from_payroll, false) = false
  AND (COALESCE({{params.manager}}, '') = '' OR e.manager = {{params.manager}})
ORDER BY pe.employee_id, LEFT(pe.work_date, 10), pe.period_name DESC
```

Params: `dateFrom`, `dateTo`, `manager`. The `DISTINCT ON` mirrors
`v_attendance_daily` — one row per employee-day, newest period wins.

## 2. `src/actions/loadMondayAttendanceFormsRange.ts`

```sql
SELECT f.employee_id,
       f.form_date::text                    AS form_date,
       COALESCE(f.form_type, '')            AS form_type,
       COALESCE(f.reason, '')               AS reason,
       COALESCE(f.details, '')              AS details,
       COALESCE(f.eta, '')                  AS eta,
       f.submitted_at,
       COALESCE(f.employee_email_raw, '')   AS employee_email_raw,
       f.monday_item_id::text               AS monday_item_id
FROM public.monday_attendance_forms f
LEFT JOIN public.employees e ON e.id = f.employee_id
WHERE f.deleted_on_monday = false
  AND f.form_date >= {{params.dateFrom}}::date
  AND f.form_date <= {{params.dateTo}}::date
  AND (COALESCE({{params.manager}}, '') = '' OR e.manager = {{params.manager}})
ORDER BY f.form_date, f.monday_item_id
```

`LEFT JOIN` and `f.employee_id` nullable are deliberate: a form matching no
employee must still come back so the page can report it. `form_date::text`
returns `YYYY-MM-DD`.

## 3. `src/actions/loadMondayRequestsRange.ts`

Any request **overlapping** the range, not merely starting inside it — a PTO
block beginning before `dateFrom` still covers days inside it.

```sql
SELECT r.employee_id,
       COALESCE(r.request_type, '')    AS request_type,
       COALESCE(r.permission_type, '') AS permission_type,
       r.start_date::text              AS start_date,
       r.end_date::text                AS end_date,
       r.return_date::text             AS return_date
FROM public.monday_requests r
LEFT JOIN public.employees e ON e.id = r.employee_id
WHERE r.deleted_on_monday = false
  AND r.employee_id IS NOT NULL
  AND COALESCE(r.start_date, r.end_date) <= {{params.dateTo}}::date
  AND COALESCE(r.return_date, r.end_date, r.start_date) >= {{params.dateFrom}}::date
  AND (COALESCE({{params.manager}}, '') = '' OR e.manager = {{params.manager}})
ORDER BY r.start_date
```

## 4. `src/actions/loadAttendanceEmployees.ts` — additive only

Keep every existing column exactly as it is (`FilterBar` and the Attendance page
both read it). Add:

```
        e.id,                      -- if not already selected
        COALESCE(e.start_date::text, '')                          AS start_date,
        COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri') AS work_days,
        s.dst_start,
        s.dst_end,
        COALESCE(s.grace_minutes, 10)                             AS grace_minutes
```

## 5. `src/app/lib/attendanceReport.ts` — the verdict module

Plain TypeScript. **No React, no JSX, no hooks, no imports from `@uibakery`** —
`node --test` imports this file directly. Import only from
`./classificationEngine` (`isScheduledWorkDay`, `getSchedule`,
`parseTimeToMinutes` are already exported there — reuse them, do not reimplement
DST or work-day logic).

### Exported types

```ts
export type ReportEmployee = {
  id: number; name: string; email: string; role: string; manager: string;
  work_days: string;          // "Mon,Tue,Wed,Thu,Fri"
  start_date: string | null;  // "YYYY-MM-DD"
  standard_start: string; standard_end: string;   // "9:00 AM"
  dst_start: string; dst_end: string;
  grace_minutes: number;
};

export type ReportPayrollRow = {
  employee_id: number; work_date: string;
  entry_time: string | null; exit_time: string | null;
  scheduled_start: string | null;
  late_minutes: number; early_leave_minutes: number;
  event_type_1: string; documentation: string; auto_notes: string;
  period_name: string;
};

export type ReportForm = {
  employee_id: number; form_date: string; form_type: string;
  reason: string; details: string; eta: string;
  submitted_at: string | null; employee_email_raw: string; monday_item_id: string;
};

export type ReportRequest = {
  employee_id: number; request_type: string; permission_type: string;
  start_date: string | null; end_date: string | null; return_date: string | null;
};

export type ReportPeriod = {
  period_name: string; start_date: string | null; end_date: string | null;
  processed_at: string | null;
};

export type ReportHoliday = { date: string; name: string };

export type Verdict =
  | 'on_time' | 'late_reported_on_time' | 'late_reported_late' | 'late_no_form'
  | 'absent_reported_on_time' | 'absent_reported_late' | 'unexplained_absence'
  | 'pto' | 'permission' | 'holiday' | 'not_processed';

export type ReportFormView = {
  type: string; reason: string; details: string; eta: string;
  submittedAt: string | null;
  submittedMinutes: number | null;   // minutes since midnight, same day only
  onTime: boolean;
  mondayItemId: string;
};

export type ReportRow = {
  employeeId: number; employeeName: string; email: string;
  role: string; manager: string;
  date: string;                       // "YYYY-MM-DD"
  scheduledStart: string;             // "9:00 AM"
  entryTime: string | null; exitTime: string | null;
  minutesLate: number; earlyLeaveMinutes: number;
  form: ReportFormView | null;        // the winning form
  allForms: ReportFormView[];         // every form on that day, earliest first
  coveredBy: { kind: 'pto' | 'permission' | 'holiday'; label: string } | null;
  verdict: Verdict;
  countsToScore: boolean;
  flags: {
    multipleForms: boolean;
    recordedUnexplainedButFormOnFile: boolean;
    formEmailUnrecognised: boolean;
  };
};

export type ReportSummary = {
  employeeId: number; employeeName: string; role: string; manager: string;
  expectedDays: number;        // days that count toward the score
  onTime: number;
  lateDays: number;            // any late verdict
  lateDaysWithoutForm: number;
  unexplainedAbsences: number;
  awayDays: number;            // pto + permission + holiday
  formsFiled: number;          // days with at least one form
  formsOnTime: number;         // of those, filed before the shift
  onTimeRate: number | null;   // percent, null when expectedDays === 0
};

export type ReportInput = {
  dateFrom: string; dateTo: string;
  employees: ReportEmployee[];
  payrollRows: ReportPayrollRow[];
  forms: ReportForm[];
  requests: ReportRequest[];
  holidays: ReportHoliday[];
  periods: ReportPeriod[];
  dstWindows: { year: number; us_dst_start: string; us_dst_end: string }[];
};

export type ReportOutput = {
  rows: ReportRow[];
  perEmployee: ReportSummary[];
  unmatchedForms: number;
};

export function buildAttendanceReport(input: ReportInput): ReportOutput;
```

Also export `AWAY_REQUEST_TYPES` and `SCORED_VERDICTS` as string arrays.

### The rules, in order

For each employee, for each date from `dateFrom` to `dateTo` inclusive:

1. **Skip** unless `isScheduledWorkDay(date, employee.work_days)`.
2. **Skip** when `employee.start_date` is set and `date < employee.start_date`.
3. `scheduledStart` = the payroll row's `scheduled_start` when there is one and
   it is non-empty; otherwise `getSchedule(employee, date, dstWindows).start`.
4. Collect that employee's forms for that date, sorted by `submitted_at`
   ascending, nulls last. `form` is the first; `allForms` is all of them;
   `flags.multipleForms` is `allForms.length > 1`.
5. A form is **on time** when it has a `submitted_at`, and either its date part
   is earlier than the row's date, or its date part equals the row's date and
   its `HH:MM` in minutes is **strictly less than** `scheduledStart` in minutes.
   A null `submitted_at` is never on time. `submittedMinutes` is set only when
   the submission is on the same day.
6. **Verdict**, first match wins:
   - a holiday whose `date` equals this date → `holiday`, `coveredBy` is that
     holiday's name.
   - an away request covering this date → `pto` for `PTO / Vacation`,
     `Floating Holiday`, `Birthday Day Off`, `Compensatory Day`; `permission`
     for `Time Off / Permission`. `Work From Home` and `Work on a Holiday` are
     **not** away — they fall through. Coverage is
     `start_date <= date < return_date`, or `start_date <= date <= end_date`
     when `return_date` is null. `coveredBy.label` is the request type.
   - the date is **not inside a processed period** → `not_processed`. A period
     counts only when `processed_at` is non-null and
     `start_date <= date <= end_date`.
   - a payroll row with a non-null `entry_time`:
     `late_minutes > 0` ? (no form → `late_no_form`; form on time →
     `late_reported_on_time`; else `late_reported_late`) : `on_time`.
   - otherwise (no punches, whether or not a payroll row exists): a form →
     `absent_reported_on_time` / `absent_reported_late` by the same test;
     no form → `unexplained_absence`.

   Note that a **Tardiness** form on a day with no punches still explains the
   day — they said they would be late and did not arrive. It is reported, not
   silent.
7. `countsToScore` is true for `on_time`, all three `late_*`, all
   `absent_reported_*` and `unexplained_absence`; false for `pto`,
   `permission`, `holiday` and `not_processed`. **This is the point of the
   feature: PTO and a birthday day off must never move someone's score, and an
   unexplained absence must.**
8. Flags:
   - `recordedUnexplainedButFormOnFile` — the payroll row's `event_type_1` is
     `Ausencia Injustificada` **and** a form exists for that day. 13 such days
     exist live; the report shows the contradiction rather than hiding it.
   - `formEmailUnrecognised` — the winning form's `employee_email_raw` is
     non-empty and, lower-cased and trimmed, differs from the employee's
     `email`. 113 such forms exist; the payroll engine cannot see any of them.

Sort `rows` by `date`, then `employeeName`.

### The summary

One entry per employee in `input.employees`, **even when they have no rows** —
`expectedDays: 0` and `onTimeRate: null`. `onTimeRate` is
`onTime / expectedDays * 100`, and is `null` when `expectedDays` is 0 so that a
fortnight of PTO never renders as a 0% score. `formsFiled` counts days with at
least one form; `formsOnTime` counts those whose winning form was on time.

### Hard constraints

- **Dates are `YYYY-MM-DD` strings compared as strings.** Never `new Date(str)`
  for date maths. Iterate the range with the same day-stepping idiom
  `classificationEngine.ts` uses.
- No `toISOString()` anywhere — a repository test forbids new occurrences.
- Under 15 KB. Split into a second lib file if it grows past that.

## Acceptance

1. Only the five files above exist or changed. `git status` shows nothing else.
2. `src/app/lib/attendanceReport.ts` imports nothing from React or `@uibakery`.
3. Each action is a single `action(...)` export in the established shape, with
   `datasourceName: 'GAF Planilla DB'`, and every `{{params.x}}` unquoted.
4. `loadAttendanceEmployees` still returns all of its current columns, unrenamed.
5. TypeScript clean.
