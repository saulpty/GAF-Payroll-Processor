# Remove the MacBook-swap feature, step 2 of 2: Roster column, sync code and actions

**Copy every edit exactly, character for character. Do not rewrite, reformat or touch anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

Saul (2026-10-07): the MacBook-swap flag was a one-time thing and must go. Step 1 already removed
the payroll rule. This step removes the "Macbook" checkbox from the Roster (table, edit form and
legend all come from `FLAG_META`) and stops every action and the Monday sync from reading or
writing the flag. The database column `employees.is_macbook_swap` **stays** (it defaults to FALSE,
so inserts that leave it out are fine); do not write a migration.

**Only these eleven files may change:**
`src/app/pages/admin/employees/rosterTypes.ts`, `src/app/pages/admin/employees/RosterTab.tsx`,
`src/app/pages/admin/employees/syncDirectory.ts`, `src/app/pages/admin/employees/MondayTab.tsx`,
`src/app/components/MondayAutoSync.tsx`, `src/actions/loadAllEmployees.ts`,
`src/actions/loadEmployees.ts`, `src/actions/updateEmployeeFlag.ts`,
`src/actions/updateEmployee.ts`, `src/actions/upsertEmployee.ts`, `src/AGENTS.md`.
No other file may be touched. Do not change `RosterForm.tsx`: it follows `FLAG_META` by itself.

## `src/app/pages/admin/employees/rosterTypes.ts`

Replace

```ts
import { Clock, Laptop, Ban, CheckCircle2, type LucideIcon } from 'lucide-react';
```

with

```ts
import { Clock, Ban, CheckCircle2, type LucideIcon } from 'lucide-react';
```

Replace `  is_grace_list: boolean; is_macbook_swap: boolean; excluded_from_payroll: boolean;`
with `  is_grace_list: boolean; excluded_from_payroll: boolean;`

Replace `  schedule_id: 0, is_grace_list: false, is_macbook_swap: false,`
with `  schedule_id: 0, is_grace_list: false,`

Replace

```ts
export type FlagKey = 'is_grace_list' | 'is_macbook_swap' | 'excluded_from_payroll' | 'active';
```

with

```ts
export type FlagKey = 'is_grace_list' | 'excluded_from_payroll' | 'active';
```

Delete this one line from `FLAG_META`:

```ts
  { key: 'is_macbook_swap',       label: 'Macbook',  icon: Laptop,       tip: 'Missing Teramind data defaults to GREEN (not flagged absent)' },
```

## `src/app/pages/admin/employees/RosterTab.tsx`

Delete these two lines (one in `handleSave`, one in `handleToggle`):

```ts
          is_macbook_swap: editing.is_macbook_swap ?? false,
```

```ts
      is_macbook_swap:       key === 'is_macbook_swap'       ? newVal : emp.is_macbook_swap,
```

## `src/app/pages/admin/employees/syncDirectory.ts`

Replace `    is_grace_list: boolean; is_macbook_swap: boolean; excluded_from_payroll: boolean;`
with `    is_grace_list: boolean; excluded_from_payroll: boolean;`

Replace `    id: number; is_grace_list: boolean; is_macbook_swap: boolean;`
with `    id: number; is_grace_list: boolean;`

Delete this one line (inside the `deps.updateFlag({ ... })` call):

```ts
        is_macbook_swap: emp.is_macbook_swap,
```

Replace **both** occurrences of
`          schedule_id: deps.defaultScheduleId, is_grace_list: false, is_macbook_swap: false,`
with `          schedule_id: deps.defaultScheduleId, is_grace_list: false,`

## `src/app/pages/admin/employees/MondayTab.tsx` and `src/app/components/MondayAutoSync.tsx`

In each file's `type EmpRow`, replace
`  active: boolean; is_grace_list: boolean; is_macbook_swap: boolean;`
with `  active: boolean; is_grace_list: boolean;`

## `src/actions/loadAllEmployees.ts` and `src/actions/loadEmployees.ts`

In each, replace
`             e.is_grace_list, e.is_macbook_swap, e.excluded_from_payroll, e.active,`
with `             e.is_grace_list, e.excluded_from_payroll, e.active,`

## `src/actions/updateEmployeeFlag.ts` and `src/actions/updateEmployee.ts`

In each, delete this one line:

```sql
        is_macbook_swap       = {{params.is_macbook_swap}}::boolean,
```

## `src/actions/upsertEmployee.ts`

Replace `        is_grace_list, is_macbook_swap, excluded_from_payroll, active, notes, role, manager)`
with `        is_grace_list, excluded_from_payroll, active, notes, role, manager)`

Replace `        {{params.is_grace_list}}::boolean, {{params.is_macbook_swap}}::boolean,`
with `        {{params.is_grace_list}}::boolean,`

Delete this one line:

```sql
        is_macbook_swap         = EXCLUDED.is_macbook_swap,
```

## `src/AGENTS.md`

In the `employees` table description, change `` `is_macbook_swap`, `` to
`` `is_macbook_swap` (unused since 2026-10-07, always FALSE), ``. Nothing else changes.

When done, reply with a one-line summary per file.
