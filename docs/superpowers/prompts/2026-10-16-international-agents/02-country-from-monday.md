# The Directory sync fills in Country from Monday

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

The previous prompt added `employees.country` (default `'Panama'`) and the config key
`monday_col_directory_country`. This prompt makes the Monday Directory sync read that column and
save it. **A blank Monday value, or no column configured, always means `Panama`.**

**Only these files may change:** `src/app/pages/admin/employees/syncDirectory.ts`,
`src/actions/updateEmployeeRoleManager.ts`, `src/actions/upsertEmployee.ts`,
`src/actions/loadAllEmployees.ts`. **No other file may be touched.** In particular do **not** edit
`MondayTab.tsx` or `src/app/components/MondayAutoSync.tsx`: they pass the action functions straight
through, so they need no change. No migration.

Rules:
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- `{{params.x}}` is substituted whole: never put it inside a quoted string.
- Every file stays under 15 KB.
- `monday_col_directory_country` is **optional**: do not add it to `DIR_KEYS` (that would make the
  sync fail while it is empty). Read it with `deps.cfg` directly.

## 1. `src/actions/loadAllEmployees.ts`

After the line `COALESCE(e.manager, '') AS manager,` add:

```sql
             e.country,
```

## 2. `src/actions/updateEmployeeRoleManager.ts`

Replace the SET clause so it reads:

```sql
         SET role    = {{params.role}},
             manager = {{params.manager}},
             country = COALESCE(NULLIF({{params.country}}, ''), country)
```

(A caller that sends no country keeps the existing one.)

## 3. `src/actions/upsertEmployee.ts`

- Add `country` to the INSERT column list, after `manager`.
- Add to the SELECT list, after `{{params.manager}}`: `, COALESCE(NULLIF({{params.country}}, ''), 'Panama')`
- Add to the `DO UPDATE SET` list, after the `manager = …` line (put a comma after that line):
  `country = COALESCE(NULLIF({{params.country}}, ''), employees.country)`

## 4. `src/app/pages/admin/employees/syncDirectory.ts`

a. In `DirectoryDeps`, `emps` items gain `country: string;` and `updateRoleManager`'s parameter
   type gains `country: string;`.

b. `ResolvedItem` gains `country: string;`.

c. At the top of `syncDirectory`, right after `const dk = dirCheck.map;`, add:

```ts
  // Optional: column id of the Country column. Empty or missing = everyone is Panama.
  const countryCol = (deps.cfg['monday_col_directory_country'] ?? '').trim();
  const countryOf = (item: MondayItem) => (countryCol ? colText(item, countryCol).trim() : '') || 'Panama';
```

   (`deps.cfg` is a plain `Record<string, string>`, see `SyncDeps` in `mondaySync.ts`.)

d. In `pullAllItems(...)`, append `countryCol` to the column list only when it is not empty:
   `...(countryCol ? [countryCol] : [])`.

e. Step 1: compute `const country = countryOf(item);` next to `role`/`manager`, push it into
   `resolved` (`{ item, empId, email, role, manager, country }`) and into each `candidateMap`
   value. `newCandidates` keeps `country`.

f. Step 3: destructure `country` too. The change test becomes
   `(role || '') !== emp.role || (manager || '') !== emp.manager || country !== (emp.country || 'Panama')`
   and the call becomes
   `deps.updateRoleManager({ id: emp.id, role: role || null, manager: manager || null, country })`.

g. Step 4: both `deps.upsertEmp({...})` calls gain `country: c.country,`. The `askCandidates`
   type keeps working because extra fields pass through; if TypeScript complains, add
   `country?: string` to its candidate type.

Nothing else in the file changes: active = Current Employees group, the 3-candidate brake, the
start-date step and the summary line stay exactly as they are.

Reply with the final diff of all four files.
