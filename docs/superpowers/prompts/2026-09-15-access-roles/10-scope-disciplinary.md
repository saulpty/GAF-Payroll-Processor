# 10 — Managers see only their own employees' disciplinary cases

## Files that may change

- `src/app/pages/disciplinary/DisciplinaryTable.tsx`

No other file may be touched. Do not change `loadDisciplinaryActions.ts`,
`lib/disciplinary.ts`, `CaseFile.tsx` or any grouping / state logic.

## Why

Disciplinary actions live in a **different database** (`SAUL Disciplinary Action
Forms DB`), and each row carries only a typed `employee_name`. SQL cannot join
it to `v_employee_access`, so this page filters after resolving names, which
it already does with `buildResolver`.

- A super user, or a manager marked "all employees", sees every case, including
  names that match nobody on the roster ("not on roster").
- Any other manager sees only cases whose name resolves to an employee in their
  groups. Unresolved names are hidden from them, because nobody can tell whose
  they are.

## The change

1. Imports: `import { useViewer } from '@/app/context/ViewerContext';` and
   `import loadVisibleEmployeeIdsAction from '@/actions/loadVisibleEmployeeIds';`
2. In `DisciplinaryTable`, after `const { employee, role, manager } = useGlobalFilters();`:
   ```tsx
   const { viewAs, allEmployees } = useViewer();
   ```
3. With the other loads (params flat):
   ```tsx
   const [visibleRaw, loadingVisible] = useLoadAction(
     loadVisibleEmployeeIdsAction,
     [] as { employee_id: number | string }[],
     { viewAs },
   );
   const visibleIds = useMemo(
     () => new Set((visibleRaw as { employee_id: number | string }[]).map(r => String(r.employee_id))),
     [visibleRaw],
   );
   ```
4. At the very start of **Stage 2** (`filtered`), right after `let rows = derived;`:
   ```tsx
   if (!allEmployees) {
     rows = rows.filter(r => r.employeeId !== null && visibleIds.has(String(r.employeeId)));
   }
   ```
   and add `allEmployees` and `visibleIds` to that `useMemo`'s dependency array.
5. While `loadingVisible` is true and `!allEmployees`, treat the table as loading
   (combine it with the existing `loading` wherever the loading state is shown),
   so a manager never sees the unfiltered list flash.

Compare ids as `String(...)` — BIGINTs can arrive as numbers or strings.

## Acceptance

1. Lint clean. Report the byte size of the file (must stay under 15 KB).
2. Then confirm every identifier used in the file is imported, in particular
   `useViewer`, `useMemo`, `loadVisibleEmployeeIdsAction`.

Do not build anything else.
