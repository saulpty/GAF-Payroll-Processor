# Roster Save: editing a person updates that person, even when the email changes

**Only these two files may change:**
1. **New** `src/actions/updateEmployee.ts`
2. `src/app/pages/admin/employees/RosterTab.tsx`

No other file may be touched: not `upsertEmployee.ts` (Monday sync and MondayTab still use it
to create people), not any other page, lib, component, migration or AGENTS.md.

## The bug

`RosterTab.handleSave` always calls `upsertEmployee`, which is
`INSERT … ON CONFLICT (teramind_email) DO UPDATE`. The email is the match key, so:
- **Editing someone and changing their email inserts a second employee.** This happened to
  Jeanine Puyol on 2026-09-25 (cleaned up by migration 1782014000).
- **Adding a new person with an email that already exists silently overwrites that
  existing person's** name, schedule and flags.

## 1. New action `src/actions/updateEmployee.ts`

Same shape as `updateEmployeeFlag.ts`. Updates by **id**, never inserts:

```ts
import { action } from '@uibakery/data';

function updateEmployee() {
  return action('updateEmployee', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE employees SET
        display_name          = {{params.display_name}},
        teramind_email        = lower(btrim({{params.teramind_email}})),
        company_domain        = {{params.company_domain}},
        schedule_id           = {{params.schedule_id}}::bigint,
        is_grace_list         = {{params.is_grace_list}}::boolean,
        is_macbook_swap       = {{params.is_macbook_swap}}::boolean,
        excluded_from_payroll = {{params.excluded_from_payroll}}::boolean,
        active                = {{params.active}}::boolean,
        notes                 = {{params.notes}}
      WHERE id = {{params.id}}::bigint
        AND public.assert_super({{ user.email }}::text);
    `,
  });
}

export default updateEmployee;
```

`{{params.x}}` is substituted whole: never put one inside quotes. `role`, `manager`,
`start_date`, `end_date` are deliberately not touched (Directory Sync owns them).

## 2. `RosterTab.tsx` changes

- Import it and add `const [updateEmp, updating] = useMutateAction(updateEmployeeAction);`.
  The Save button's busy state becomes `saving || updating`.
- Add `const [saveError, setSaveError] = useState<string | null>(null);`. Clear it when the
  form opens (`handleNew`, `handleEdit`) and at the start of `handleSave`.
- `handleSave` becomes:
  1. `const email = (editing.teramind_email ?? '').trim().toLowerCase();`
  2. **Duplicate-email guard** (runs for both new and edit): if any row in `emps` has
     `teramind_email.trim().toLowerCase() === email` **and a different `id`** than
     `editing.id`, set
     `saveError` to `That email already belongs to <their display_name>. Nothing was saved.`
     and `return` without calling any action.
  3. If `editing.id` is a number, call `updateEmp({...})` with exactly the params above
     (`id`, the eight fields, `teramind_email: email`, `excluded_from_payroll ?? false`),
     **flat**, no `params:` wrapper. Otherwise (new person) keep the existing
     `upsertEmp(...)` call unchanged, with `teramind_email: email`.
  4. Wrap the action call in `try/catch`. On error set `saveError` to
     `Could not save: <error message>` and keep the form open. Only on success close the
     form, clear `editing`, and `await reload()`.
- Show `saveError` inside the form, directly above the Save button, as a small red line
  (`text-red-700 text-xs`), only when set.
- If the edited email differs from the email the row was opened with, show a one-line grey hint
  under the email field: `Changing the email keeps all history with this person.`

Keep `RosterTab.tsx` under 15 KB (it is ~13.1 KB now). If it would exceed that, move the
save logic into a new hook instead, and say so. That is the only extra file allowed.

## Report

- The final `handleSave` code.
- The byte size of both files.
- Confirm `upsertEmployee.ts`, `MondayTab.tsx` and `MondayAutoSync.tsx` are unchanged.
