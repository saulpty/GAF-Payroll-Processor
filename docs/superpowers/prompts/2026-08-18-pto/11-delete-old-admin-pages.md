The new Employees hub has been verified against the three pages it replaces. Remove the old pages and give the hub their route. This is a deletion-only change plus route and nav edits.

Delete exactly these five files:
- `src/app/pages/admin/AdminEmployees.tsx`
- `src/app/pages/admin/AdminEmployeeSync.tsx`
- `src/app/pages/admin/AdminAliases.tsx`
- `src/actions/loadEmployeeDirectory.ts`
- `src/actions/fetchMondayStartDates.ts`

Modify only `src/app/app.tsx` and `src/app/TopNav.tsx`. No other file may change. Do NOT modify `AdminLayout.tsx`, `ProcessPayroll.tsx`, `pullMondayBoard.ts`, or anything under `src/app/pages/admin/employees/`.

Before deleting, confirm nothing still imports the two actions. `loadEmployeeDirectory` and `fetchMondayStartDates` were only used by `AdminEmployeeSync.tsx`, which is also being deleted; the new Monday tab calls `pullMondayBoard` instead. If you find any other importer, stop and tell me rather than deleting.

**app.tsx**
- Remove the imports of the three deleted pages.
- Change the hub route from `employees-hub` to `employees`.
- Remove the `aliases` and `directory-sync` routes, replacing each with a redirect so old bookmarks still land somewhere: `aliases` → `/admin/employees?tab=aliases`, `directory-sync` → `/admin/employees?tab=monday`, both using `<Navigate ... replace />`.
- Keep the `index` redirect to `/admin/employees`.

**TopNav.tsx**
- In the Admin section remove the "Employees (new)", "Directory Sync" and "Name Aliases" links.
- The remaining "Employees" link points at `/admin/employees` with the Users icon. Do not reorder the other links.

Acceptance: `/admin/employees` opens the hub on the Roster tab; `/admin/aliases` redirects to the Aliases tab; `/admin/directory-sync` redirects to the Monday tab; the app builds with no missing-import errors; the Admin nav shows a single Employees entry; and exactly the five files above are gone with only app.tsx and TopNav.tsx modified.
