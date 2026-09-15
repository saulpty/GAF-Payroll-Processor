# 07 — Managers see only their own employees on Attendance (List and Reports)

## Files that may change

- `src/actions/loadAttendanceEmployees.ts`
- `src/actions/loadAttendanceDaily.ts`
- `src/actions/loadAttendanceReportDays.ts`
- `src/actions/loadMondayRequestsRange.ts`
- `src/actions/loadMondayAttendanceFormsRange.ts`
- `src/app/FilterBar.tsx` — one import, one hook line, one call site
- `src/app/pages/Attendance.tsx` — one import, one hook line, two call sites
- `src/app/pages/attendance/AttendanceReport.tsx` — one import, one hook line, four call sites

No other file may be touched. Do not reformat. Do not change any other SQL line,
any calculation, or any date handling. No time or date value is changed;
timezone invariant unaffected.

## Why

`v_employee_access` lists, for each signed-in email, the employees that person
may see (super users and "all employees" managers: everyone; other managers:
the members of their groups). `access_viewer({{ user.email }}, {{params.viewAs}}::text)`
returns the effective email (a super user may "view as" someone).

This round filters the Attendance data by it **in SQL**, so a manager's browser
never receives other employees' rows. A super user still sees everything,
because the view lists every employee for them. The existing `manager` name
filter stays as it is.

## 1. The five actions — add exactly these lines

Keep every existing line. `{{params.viewAs}}` is never inside quotes.

**`loadAttendanceEmployees.ts`** — after `AND COALESCE(e.excluded_from_payroll, false) = false` add:
```sql
        AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                      WHERE a.email = access_viewer({{ user.email }}, {{params.viewAs}}::text))
```

**`loadAttendanceReportDays.ts`** — after the `manager` line add the same two lines.

**`loadMondayRequestsRange.ts`** — after the `manager` line add:
```sql
        AND r.employee_id IN (SELECT a.employee_id FROM public.v_employee_access a
                               WHERE a.email = access_viewer({{ user.email }}, {{params.viewAs}}::text))
```

**`loadMondayAttendanceFormsRange.ts`** — after the `manager` line add (forms
that match no employee are shown to super users only):
```sql
        AND (f.employee_id IN (SELECT a.employee_id FROM public.v_employee_access a
                                WHERE a.email = access_viewer({{ user.email }}, {{params.viewAs}}::text))
             OR (f.employee_id IS NULL AND EXISTS (
                   SELECT 1 FROM public.app_users u
                    WHERE u.email = access_viewer({{ user.email }}, {{params.viewAs}}::text)
                      AND u.role = 'super_user' AND u.active)))
```

**`loadAttendanceDaily.ts`** — this reads the view `v_attendance_daily`, keyed by
email. After the `email` line add:
```sql
        AND email IN (SELECT e.teramind_email FROM public.employees e
                        JOIN public.v_employee_access a ON a.employee_id = e.id
                       WHERE a.email = access_viewer({{ user.email }}, {{params.viewAs}}::text))
```

## 2. Call sites — pass `viewAs`, flat

In each of the three files add `import { useViewer } from '@/app/context/ViewerContext';`
and, next to the existing `useGlobalFilters()` call, `const { viewAs } = useViewer();`.

- **`FilterBar.tsx`**: `useLoadAction(loadAttendanceEmployeesAction, [] as EmpInfo[])`
  becomes `useLoadAction(loadAttendanceEmployeesAction, [] as EmpInfo[], { viewAs })`.
- **`Attendance.tsx`**:
  - `{ dateFrom: safeFrom, dateTo: safeTo, email: '' }` becomes
    `{ dateFrom: safeFrom, dateTo: safeTo, email: '', viewAs }`.
  - `useLoadAction(loadAttendanceEmployeesAction, [] as EmpInfo[])` gains a third
    argument `{ viewAs }`.
- **`AttendanceReport.tsx`**:
  - The three `{ dateFrom: safeFrom, dateTo: safeTo, manager: manager || '' }`
    objects (report days, forms, requests) each gain `, viewAs`.
  - `useLoadAction(loadAttendanceEmployeesAction, [] as ReportEmployee[])` gains
    a third argument `{ viewAs }`.

Never wrap them as `{ params: { … } }`.

## Acceptance — run and paste raw results

1. For each of the five actions, run with the parameters its page uses plus
   `viewAs: ''`, and report the row count. `loadAttendanceEmployees` must return
   45 (all active, non-excluded employees).
2. Run `loadAttendanceEmployees` with `{ viewAs: 'nobody@example.com' }` → 0 rows.
3. Lint clean.
4. Then confirm every identifier used in each changed file is imported, in
   particular `useViewer` in all three `.tsx` files.

Do not build anything else. Do not offer to scope other pages.
