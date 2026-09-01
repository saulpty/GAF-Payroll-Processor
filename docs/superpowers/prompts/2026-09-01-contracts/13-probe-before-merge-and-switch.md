# Read-only: what references Euclides 47, and does `color_mkpt5gk4` cover everyone?

**This is a question, not a change. Do not edit, create or delete any file. Do
not delete any row. Do not write a migration. Do not run a sync.**

Two decisions depend on these numbers.

## Part A — what is attached to each Euclides record?

`employees` has two records for one person: **47** (inactive,
`javierqvistgaard@hotmail.com`) and **49** (active,
`javier.g@passiontocarehc.com`).

`payroll_entries.employee_id` and `name_aliases.employee_id` are
`NOT NULL REFERENCES employees(id)` with **no ON DELETE clause**, so Postgres
will refuse to delete 47 while either holds a row. The three `monday_*` mirrors
are `ON DELETE SET NULL`, so deleting 47 would blank his board row's
`employee_id` instead of moving it.

```sql
SELECT 'payroll_entries'          AS table_name,
       count(*) FILTER (WHERE employee_id = 47) AS on_47,
       count(*) FILTER (WHERE employee_id = 49) AS on_49
FROM payroll_entries
UNION ALL SELECT 'payroll_entries_not_deleted',
       count(*) FILTER (WHERE employee_id = 47 AND deleted_at IS NULL),
       count(*) FILTER (WHERE employee_id = 49 AND deleted_at IS NULL)
FROM payroll_entries
UNION ALL SELECT 'name_aliases',
       count(*) FILTER (WHERE employee_id = 47), count(*) FILTER (WHERE employee_id = 49)
FROM name_aliases
UNION ALL SELECT 'monday_contracts',
       count(*) FILTER (WHERE employee_id = 47), count(*) FILTER (WHERE employee_id = 49)
FROM monday_contracts
UNION ALL SELECT 'monday_requests',
       count(*) FILTER (WHERE employee_id = 47), count(*) FILTER (WHERE employee_id = 49)
FROM monday_requests
UNION ALL SELECT 'monday_attendance_forms',
       count(*) FILTER (WHERE employee_id = 47), count(*) FILTER (WHERE employee_id = 49)
FROM monday_attendance_forms
UNION ALL SELECT 'pto_approvals',
       count(*) FILTER (WHERE employee_id = 47), count(*) FILTER (WHERE employee_id = 49)
FROM pto_approvals
UNION ALL SELECT 'pto_employees',
       count(*) FILTER (WHERE employee_id = 47), count(*) FILTER (WHERE employee_id = 49)
FROM pto_employees;
```

If a table above does not exist, say so and skip it rather than failing the
batch.

Also, the two records side by side:

```sql
SELECT id, display_name, active, teramind_email, schedule_id,
       excluded_from_payroll, is_grace_list, is_macbook_swap,
       start_date::text, end_date::text, notes
FROM employees WHERE id IN (47, 49) ORDER BY id;
```

And which payroll periods sit on 47:

```sql
SELECT period_name, count(*) AS rows
FROM payroll_entries
WHERE employee_id = 47 AND deleted_at IS NULL
GROUP BY period_name ORDER BY period_name;
```

## Part B — is `color_mkpt5gk4` populated for everyone?

Saul says `color_mkpt5gk4` is the column that should be syncing States across the
board, and `monday_col_onboarding_state` currently points at the mirror
`lookup_mktc2x46`. **Before switching the config we must know the new column is
at least as complete**, because the last time config was pointed at a "better"
column it silently blanked the field for everyone (`BACKLOG.md` #3).

Read board `8661565945` through the existing `pullMondayBoard` action — pass the
whole GraphQL query as the single `query` parameter, never inside a quoted
string. Request both column ids for every item. Mirror columns carry their value
in `display_value`; status/colour columns carry theirs in `text` or `label`.

Report:

| | `lookup_mktc2x46` (mirror, current) | `color_mkpt5gk4` (proposed) |
|---|---|---|
| items with a value | ? | ? |
| items blank | ? | ? |

and **every item where the two differ**, including blanks on either side, with
the item name and both values.

If the API call is blocked, say so plainly rather than guessing — do not infer
the answer from `monday_contracts.raw`, which only contains the five columns we
already request.

Report everything. **Change nothing.**
