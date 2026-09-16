# 03 — The Manager filter follows the access groups (Monday Manager, Manager 2, 3, 4)

## Files that may change

- `src/migrations/1782002300_v_employee_managers.sql` (new) — create and apply
- `src/app/lib/managerFilter.ts` (new) — exactly as given
- Actions — only the lines named in section 3:
  `loadAttendanceEmployees.ts`, `loadAttendanceReportDays.ts`, `loadMondayRequestsRange.ts`,
  `loadMondayAttendanceFormsRange.ts`, `loadPtoBalancesInputs.ts`, `loadPtoEmployeeDetail.ts`,
  `loadPendingPtoRequests.ts`, `loadPtoReviewCount.ts`, `loadContractMilestones.ts`
- `src/app/FilterBar.tsx` — the `managers` list only
- `src/app/pages/Attendance.tsx` — the manager condition only
- `src/app/pages/attendance/AttendanceReport.tsx` — the manager condition only

No other file may be touched. Do not touch `loadDisciplinaryActions.ts`, `loadDirectoryReconciliation.ts`,
`updateEmployeeRoleManager.ts` or `upsertEmployee.ts`. Keep every `v_employee_access` / `access_viewer`
clause exactly as it is.

## Why

The global **Manager** dropdown (Attendance, PTO Tracker, Contracts) is built from `employees.manager`,
a single name the directory sync copies from Monday's Manager column. It is stale and knows nothing of
Manager 2, 3, 4. Example: viewing as Lily Beasly, the dropdown lists Chaya Lichy, Shaquille Withers and
Tim Moore — Lily herself is missing.

Access groups (Admin > Access) now follow Monday automatically and hold every manager with a rank.
New rule:
- The dropdown lists **every manager in the access groups** of the employees the viewer can see.
- Picking a manager shows **every employee that manager covers, at any rank**.
- The **Manager column** shows the direct manager (rank 1); if an employee is in no group, the old
  `employees.manager` text.

## 1. Migration `src/migrations/1782002300_v_employee_managers.sql`

Create this file with exactly this SQL, then apply it.

```sql
-- One row per (employee, manager) from the access groups, with the manager's rank.
-- Used by the global Manager filter. Rollback: DROP VIEW v_employee_managers;
CREATE OR REPLACE VIEW v_employee_managers AS
  SELECT m.employee_id,
         gm.rank,
         u.email AS manager_email,
         COALESCE(NULLIF(btrim(u.display_name), ''), u.email) AS manager_name
    FROM access_group_members m
    JOIN access_group_managers gm ON gm.group_id = m.group_id
    JOIN app_users u ON u.id = gm.user_id
   WHERE u.active;
```

## 2. `src/app/lib/managerFilter.ts` (new, NO imports)

```ts
/** The Manager filter follows the access groups (Admin > Access), which follow Monday:
 *  `manager` = direct manager (rank 1), `managers` = every manager name, "|"-separated, by rank. */
export type ManagedEmployee = { manager?: string | null; managers?: string | null };

export function managerNamesOf(e: ManagedEmployee): string[] {
  const all = String(e.managers ?? '').split('|').map(s => s.trim()).filter(Boolean);
  if (all.length) return [...new Set(all)];
  const direct = String(e.manager ?? '').trim();
  return direct ? [direct] : [];
}

export function managerOptions(emps: ManagedEmployee[]): string[] {
  return [...new Set(emps.flatMap(managerNamesOf))].sort((a, b) => a.localeCompare(b));
}

export function matchesManager(e: ManagedEmployee, selected: string | null | undefined): boolean {
  const s = String(selected ?? '').trim();
  return !s || managerNamesOf(e).includes(s);
}
```

## 3. Actions

**3a. The filter clause — 8 actions.** In each of `loadAttendanceReportDays`, `loadMondayRequestsRange`,
`loadMondayAttendanceFormsRange`, `loadPtoBalancesInputs`, `loadPtoEmployeeDetail`,
`loadPendingPtoRequests`, `loadPtoReviewCount`, `loadContractMilestones`, replace only the comparison
`e.manager = {{params.manager}}` with:

```sql
e.id IN (SELECT vm.employee_id FROM public.v_employee_managers vm WHERE vm.manager_name = {{params.manager}}::text)
```

Leave the rest of that line (the `IS NULL` / `= ''` / `COALESCE` guard) exactly as it is.

**3b. The Manager column — direct manager.** Define `DIRECT` as:

```sql
COALESCE((SELECT vm.manager_name FROM public.v_employee_managers vm WHERE vm.employee_id = e.id ORDER BY vm.rank, vm.manager_name LIMIT 1), e.manager, '')
```

- `loadAttendanceEmployees`: `COALESCE(e.manager, '') AS manager,` becomes `DIRECT AS manager,`
- `loadContractMilestones`: `COALESCE(e.manager, '')       AS manager,` becomes `DIRECT AS manager,`
- `loadPtoBalancesInputs`: in the first SELECT line, `e.manager,` becomes `DIRECT AS manager,`

**3c. All managers — `loadAttendanceEmployees` only.** Directly after the `DIRECT AS manager,` line add:

```sql
        COALESCE((SELECT string_agg(x.manager_name, '|' ORDER BY x.rank, x.manager_name)
                    FROM (SELECT vm.manager_name, MIN(vm.rank) AS rank
                            FROM public.v_employee_managers vm
                           WHERE vm.employee_id = e.id
                           GROUP BY vm.manager_name) x), '') AS managers,
```

## 4. `src/app/FilterBar.tsx`

- Add `import { managerOptions } from '@/app/lib/managerFilter';`
- Replace
  `const managers = useMemo(() => [...new Set(emps.map(e => e.manager).filter(Boolean))].sort(), [emps]);`
  with
  `const managers = useMemo(() => managerOptions(emps), [emps]);`

## 5. `src/app/pages/Attendance.tsx`

- Add `import { matchesManager } from '@/app/lib/managerFilter';`
- Replace `(!manager || e.manager === manager) &&` with `matchesManager(e, manager) &&`

## 6. `src/app/pages/attendance/AttendanceReport.tsx`

- Add `import { matchesManager } from '@/app/lib/managerFilter';`
- Replace `if (manager && e.manager !== manager) return false;` with
  `if (!matchesManager(e, manager)) return false;`

## Acceptance

1. The migration applied without error.
2. Lint clean.
3. `grep -rn "e.manager = {{params.manager}}" src/actions/` returns only `loadDirectoryReconciliation.ts`-style lines outside the 8 listed actions (report what remains).
4. Every action still contains its `v_employee_access` / `access_viewer({{ user.email }}::text, {{params.viewAs}}::text)` clause, unchanged.
5. Confirm every identifier used in the three components is imported.

Do not build anything else.
