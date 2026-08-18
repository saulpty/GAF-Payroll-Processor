Build the shell of a new consolidated Employees admin page. This is the first step of replacing Admin → Employees, Directory Sync and Name Aliases with one page. The old pages must keep working untouched.

Files that may be created: `src/app/pages/admin/AdminEmployeesHub.tsx`, `src/app/pages/admin/employees/RosterTab.tsx`.
Files that may be modified, minimally: `src/app/app.tsx` (add one nested admin route), `src/app/TopNav.tsx` (add one admin sub-link).
No other file may change. In particular do NOT modify `AdminEmployees.tsx`, `AdminEmployeeSync.tsx`, `AdminAliases.tsx`, `AdminLayout.tsx`, or anything under `src/actions/`.

## AdminEmployeesHub.tsx
- Route: `employees-hub` under the existing `/admin` `AdminLayout` route in `app.tsx` (i.e. `/admin/employees-hub`). Keep the existing `employees`, `aliases`, `directory-sync` routes exactly as they are.
- Header: title "Employees", subtitle "Roster · Monday · Aliases".
- Tab strip with three tabs — Roster, Monday, Aliases — driven by the URL search param `tab` (`?tab=roster` default, `?tab=monday`, `?tab=aliases`) using `useSearchParams` from react-router-dom, so a reload keeps the tab. Use the same visual style as the tab strip on the Attendance page.
- Renders `<RosterTab />` for roster. For the other two tabs render a placeholder card with the text "Coming next" — those components are added in later steps.
- Keep this file small (well under 10 KB): it only owns the header, tab strip and routing.

## employees/RosterTab.tsx
- The Roster tab is the current Admin → Employees page moved as-is: the same active/inactive counters, search box, Active/Inactive/All filter, the grid (Name, Teramind Email, Domain, Schedule, Grace, Macbook, Excluded, Active, Edit) and the Add Employee / Edit dialog. Reproduce the behaviour of `src/app/pages/admin/AdminEmployees.tsx` by moving its JSX and handlers into this component, using the same actions: `loadAllEmployees`, `loadSchedules`, `upsertEmployee`, `updateEmployeeFlag`. Do not change what those actions receive.
- If moving everything would push this file past 15 KB, split the edit dialog into `src/app/pages/admin/employees/EmployeeEditDialog.tsx` (that file is then also allowed).

## TopNav.tsx
- In the Admin section's sub-links, add `{ to: '/admin/employees-hub', label: 'Employees (new)', icon: Users }` immediately after the existing Employees link. Do not remove or reorder existing links.

Acceptance:
- `/admin/employees-hub` shows the tab strip; the Roster tab lists the same employees with the same counts as `/admin/employees`; toggling a flag (e.g. Grace) on the new page and reloading `/admin/employees` shows the same value; Add Employee works from the new page.
- `/admin/employees`, `/admin/directory-sync`, `/admin/aliases` are unchanged and still work.
- Only the four files named above changed (plus `EmployeeEditDialog.tsx` if the split was needed).
