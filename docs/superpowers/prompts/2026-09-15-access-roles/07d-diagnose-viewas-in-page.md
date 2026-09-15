# 07d — Diagnostic only: the Attendance page ignores viewAs

## Files that may change

**None.** Do not create, edit or delete any file. Read and run only.

## What we see

On `/dev`, a super user sets "view as" `marcela.g@vitasyahc.com` (a manager whose
access group has 10 employees). `loadCurrentViewer` clearly receives it — the
page shows "Viewing as Marcela Gordon" and hides Payroll and Admin. But the
Attendance List and Reports still show all 45 employees and company-wide totals,
even after a full page reload. `loadAttendanceEmployees` now contains:

```sql
AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
              WHERE a.email = access_viewer({{ user.email }}, {{params.viewAs}}::text))
```

and `FilterBar.tsx` / `Attendance.tsx` call it with `{ viewAs }` (flat).

## Run these read actions and paste the raw row counts

1. `loadCurrentViewer` with `{ viewAs: 'marcela.g@vitasyahc.com' }` → email, role, all_employees.
2. `loadVisibleEmployeeIds` with `{ viewAs: 'marcela.g@vitasyahc.com' }` → row count.
3. `loadAttendanceEmployees` with `{ viewAs: 'marcela.g@vitasyahc.com' }` → row count.
4. `loadAttendanceEmployees` with `{ viewAs: '' }` → row count.

## Then answer, marking each "verified" or "not verified"

a. When a page calls `useLoadAction(action, default, { viewAs })`, is that
   object sent to the server and substituted into `{{params.viewAs}}`?
b. Can the `/dev` runtime run an **older** saved version of an action after it
   was edited (cached action definitions or cached results)? If so, how is it
   refreshed?
c. Is there anything about using `{{ user.email }}` and `{{params.x}}` in the
   same query, or inside a sub-select, that changes how either is substituted?

Do not change any file. Do not offer a fix.
