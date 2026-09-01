# Read-only: why does Euclides Gonzalez have no Onboarding board row?

**This is a question, not a change. Do not edit, create or delete any file.**
**Do not run a sync.** Report each result as a table.

After the re-sync, the Contracts page shows 45 active employees. Johann Morante's
State filled in correctly. But **Euclides Gonzalez now carries a
"Not on Onboarding board" chip** — his `has_board_row` is false. Before the
re-sync there were 44 employees and none were off-board.

Two possibilities, and they have very different consequences:

- his item was **removed from the board**, so the sync flagged it
  `deleted_on_monday = true`; or
- his item is still there but **no longer matches an employee** — the name
  changed, so `employee_id` came back NULL.

The second is the more dangerous one: an unmatched row is invisible to every
page that joins on `employee_id`.

## Query 1 — his mirror rows, including deleted ones

```sql
SELECT mc.monday_item_id,
       mc.employee_name_raw,
       mc.employee_id,
       mc.deleted_on_monday,
       mc.board_group,
       COALESCE(NULLIF(TRIM(mc.state), ''), '(blank)') AS state,
       mc.start_date::text        AS start_date,
       mc.contract_end_date::text AS contract_end_date,
       mc.synced_at::text
FROM monday_contracts mc
WHERE mc.employee_name_raw ILIKE '%Euclides%'
   OR mc.employee_name_raw ILIKE '%Gonzalez%'
ORDER BY mc.deleted_on_monday, mc.employee_name_raw;
```

## Query 2 — the shape of the re-sync overall

```sql
SELECT count(*)                                          AS all_rows,
       count(*) FILTER (WHERE deleted_on_monday)         AS flagged_deleted,
       count(*) FILTER (WHERE NOT deleted_on_monday)     AS live_rows,
       count(*) FILTER (WHERE NOT deleted_on_monday
                          AND employee_id IS NULL)       AS live_but_unmatched,
       max(synced_at)::text                              AS newest_sync
FROM monday_contracts;
```

## Query 3 — every live board row we could not match to an employee

```sql
SELECT monday_item_id, employee_name_raw, board_group, synced_at::text
FROM monday_contracts
WHERE deleted_on_monday = false
  AND employee_id IS NULL
ORDER BY employee_name_raw;
```

## Query 4 — how he appears on the roster

```sql
SELECT id, display_name, active,
       COALESCE(role, '(blank)')    AS role,
       COALESCE(manager, '(blank)') AS manager,
       teramind_email,
       start_date::text AS roster_start
FROM employees
WHERE display_name ILIKE '%Euclides%' OR display_name ILIKE '%Gonzalez%'
ORDER BY display_name;
```

Report all four. State plainly which of the two causes the evidence supports —
**removed from the board**, or **still on the board but no longer matching an
employee**. Change nothing.
