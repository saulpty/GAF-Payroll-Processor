# Create two read-only SQL actions for the Contracts page

**Create exactly two new files:**

- `src/actions/loadContractMilestones.ts`
- `src/actions/loadContractsExpiringCount.ts`

**No other file may be created, modified or deleted.** Do not touch any page,
`app.tsx`, `TopNav.tsx`, `FilterBar.tsx`, `src/app/lib/tenure.ts`, any existing
action, or any migration. Both actions are **SELECT only** — no INSERT, UPDATE,
DELETE, or DDL anywhere in this change.

Follow `src/actions/loadPtoBalancesInputs.ts` and
`src/actions/loadUnresolvedCount.ts` exactly for file shape: one action per
file, `datasourceName: 'GAF Planilla DB'`, default export of the factory
function.

## Three rules that have each already cost this project a day

1. **`{{params.x}}` is substituted as a whole value.** It must never appear
   inside a quoted string. Writing `'%{{params.q}}%'` sends the literal text to
   the database. Copy the guard idiom from `loadPtoBalancesInputs.ts` verbatim:
   `AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})`
2. **Cast every date to text.** Postgres returns a full timestamp otherwise, and
   the client compares dates as `'YYYY-MM-DD'` strings. Use `::text` on each.
3. **Active means the Directory's Current Employees group.** `employees.active`
   is already written from that group by the Directory sync, so `e.active = true`
   is correct and sufficient. **Do not add any filter on a status column** — no
   such column is involved here.

## 1. `loadContractMilestones.ts`

One row per active employee. Takes two optional filters, `manager` and
`employeeId`, both of which must work when null or empty (the page passes them
through unset most of the time).

Select exactly these columns, with exactly these aliases:

```
employee_id      -- e.id
display_name     -- e.display_name
role             -- COALESCE(e.role, '')
manager          -- COALESCE(e.manager, '')
roster_start     -- e.start_date::text
board_start      -- c.start_date::text
position         -- c.position
state            -- c.state
contract_end     -- c.contract_end_date::text
has_board_row    -- boolean: whether a live board row was found
```

### Picking one board row per employee

An employee can in principle have more than one live row on the Onboarding
board (a rehire). **The row with the latest start date wins.** Use a lateral
join so the choice is made in SQL:

```sql
LEFT JOIN LATERAL (
  SELECT mc.*
  FROM monday_contracts mc
  WHERE mc.employee_id = e.id
    AND mc.deleted_on_monday = false
  ORDER BY mc.start_date DESC NULLS LAST
  LIMIT 1
) c ON true
```

`deleted_on_monday = false` matters: rows are never deleted from the mirror,
only flagged.

Order by `e.display_name`.

The whole shape, with the filters:

```sql
SELECT e.id AS employee_id,
       e.display_name,
       COALESCE(e.role, '')    AS role,
       COALESCE(e.manager, '') AS manager,
       e.start_date::text        AS roster_start,
       c.start_date::text        AS board_start,
       c.position,
       c.state,
       c.contract_end_date::text AS contract_end,
       (c.monday_item_id IS NOT NULL) AS has_board_row
FROM employees e
LEFT JOIN LATERAL ( … as above … ) c ON true
WHERE e.active = true
  AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
  AND ({{params.employeeId}} IS NULL OR {{params.employeeId}} = '' OR e.id::text = {{params.employeeId}}::text)
ORDER BY e.display_name;
```

**Expected today: 44 rows**, every one with `has_board_row = true`.

## 2. `loadContractsExpiringCount.ts`

Exactly the shape of `loadUnresolvedCount.ts` — a single row, single column
named `count`, cast `::int`. **No parameters at all.**

Count active employees whose chosen board row has a contract end date falling
in the next 30 days, today included:

```sql
SELECT COUNT(*)::int AS count
FROM employees e
JOIN LATERAL ( … the same lateral join … ) c ON true
WHERE e.active = true
  AND c.contract_end_date >= CURRENT_DATE
  AND c.contract_end_date < CURRENT_DATE + 30;
```

**Expected today: 1** — Carlos Aloma, whose contract ends 2026-09-02.

## Acceptance

- Two new files, nothing else changed.
- `loadContractMilestones` with no parameters returns **44 rows**; Carlos Aloma
  shows `contract_end` = `2026-09-02` and Ulla Hees shows `2026-05-19`.
- Passing a `manager` returns a subset; passing an empty string returns all 44.
- `loadContractsExpiringCount` returns a single row, `count` = **1**.
- Every returned date is a plain `YYYY-MM-DD` string, not a timestamp.

Run both actions once and paste the row counts and the first few rows into your
reply so the numbers can be checked.
