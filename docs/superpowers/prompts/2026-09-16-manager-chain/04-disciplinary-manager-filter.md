# 04 — Disciplinary: the Manager filter means the employee's managers (any rank)

## Files that may change

- `src/app/pages/disciplinary/DisciplinaryTable.tsx`

No other file may be touched. Do not change `loadDisciplinaryActions.ts` or `DisciplinaryRow.tsx`.

## Why

Saul's rule: **every manager of an employee (Manager, Manager 2, 3, 4 on Monday) sees that employee's
disciplinary actions.** Row visibility already follows the access groups (`loadVisibleEmployeeIds`).
But the global **Manager** dropdown is passed to `loadDisciplinaryActions`, which filters on
`manager_name` — the person who **filed** the form. Picking "Lily Beasly" therefore shows only forms
Lily filed, not the cases of the employees she manages. On Attendance, PTO and Contracts the same
dropdown already means "employees this manager covers, at any rank" (`src/app/lib/managerFilter.ts`).

## Changes in `DisciplinaryTable.tsx`

1. Imports — add:
   ```ts
   import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
   import { matchesManager } from '@/app/lib/managerFilter';
   ```

2. The `loadDisciplinaryActions` call: `{ manager: manager || null, employeeName: null }` becomes
   `{ manager: null, employeeName: null }`.

3. Directly after the `visibleIds` `useMemo`, add:
   ```ts
   // Each employee's managers from the access groups ("|"-separated, by rank).
   const [mgrRaw] = useLoadAction(
     loadAttendanceEmployeesAction,
     [] as { id: number | string; manager: string; managers: string }[],
     { viewAs },
   );
   const managersById = useMemo(
     () => new Map((mgrRaw as { id: number | string; manager: string; managers: string }[])
       .map(e => [String(e.id), { manager: e.manager, managers: e.managers }])),
     [mgrRaw],
   );
   ```

4. In the Stage 2 `filtered` memo, directly after the `if (!allEmployees) { … }` block, add:
   ```ts
   if (manager) {
     rows = rows.filter(r => r.employeeId !== null
       && matchesManager(managersById.get(String(r.employeeId)) ?? {}, manager));
   }
   ```
   and add `manager, managersById` to that memo's dependency array.

5. In `COLUMNS`, the `manager` column: `label: 'Manager'` becomes `label: 'Filed by'`, and its `tip`
   becomes `'The manager who filed the latest action. Use the Manager filter above to see every case for the employees a manager covers.'`

Nothing else changes.

## Acceptance

1. Lint clean. File stays under 15 KB (report its size).
2. `loadDisciplinaryActions` is now always called with `manager: null`.
3. Confirm every identifier used in the file is imported.

Do not build anything else.
