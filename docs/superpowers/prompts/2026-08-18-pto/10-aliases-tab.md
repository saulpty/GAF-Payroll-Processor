Add the Aliases tab to the Employees hub by moving the current Admin → Name Aliases page into a tab component.

Files that may be created: `src/app/pages/admin/employees/AliasesTab.tsx`.
Files that may be modified: `src/app/pages/admin/AdminEmployeesHub.tsx` (only to import and render `AliasesTab` for `?tab=aliases`).
No other file may change. Do NOT modify or delete `AdminAliases.tsx` yet.

`AliasesTab.tsx` reproduces `src/app/pages/admin/AdminAliases.tsx` as-is: the alias list with employee names, search, add-alias form, delete — using the same actions `loadNameAliasesAdmin`, `deleteNameAlias`, `saveNameAlias`, `loadAllEmployees` with the same params.

Acceptance: `/admin/employees-hub?tab=aliases` shows the same alias count as `/admin/aliases`; adding an alias on the new tab shows on the old page after reload (then delete it from either). Only the two files named changed.
