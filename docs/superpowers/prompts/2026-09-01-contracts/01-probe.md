# Read-only: how much contract data actually exists?

**This is a question, not a change. Do not edit, create or delete any file.**
Run the four queries below against `GAF Planilla DB` and report each result as a
table in your reply. Change nothing. Do not write a migration. Do not "fix"
anything you notice.

Context: we are about to build a Contracts page from `monday_contracts`. Before
building a countdown to contract end dates, we need to know how many of them are
filled in and how many are still in the future.

`c` below is each active employee's **single most relevant** contract row — the
live board row with the latest start date, which is how the page will pick one
when a rehire has two.

## Query 1 — coverage

```sql
SELECT
  count(*)                                                        AS active_employees,
  count(*) FILTER (WHERE e.start_date IS NULL)                    AS null_roster_start,
  count(*) FILTER (WHERE c.monday_item_id IS NOT NULL)            AS with_board_row,
  count(*) FILTER (WHERE c.monday_item_id IS NULL)                AS no_board_row,
  count(*) FILTER (WHERE c.contract_end_date IS NOT NULL)         AS with_end_date,
  count(*) FILTER (WHERE c.contract_end_date >= CURRENT_DATE)     AS end_date_future,
  count(*) FILTER (WHERE c.contract_end_date >= CURRENT_DATE
                    AND c.contract_end_date < CURRENT_DATE + 30)  AS ending_within_30,
  count(*) FILTER (WHERE c.contract_end_date < CURRENT_DATE)      AS end_date_past,
  count(*) FILTER (WHERE c.start_date IS NOT NULL
                    AND e.start_date IS NOT NULL
                    AND c.start_date <> e.start_date)             AS start_date_mismatch
FROM employees e
LEFT JOIN LATERAL (
  SELECT mc.*
  FROM monday_contracts mc
  WHERE mc.employee_id = e.id
    AND mc.deleted_on_monday = false
  ORDER BY mc.start_date DESC NULLS LAST
  LIMIT 1
) c ON true
WHERE e.active = true;
```

## Query 2 — every contract end date we have, soonest first

```sql
SELECT e.display_name,
       c.position,
       c.state,
       e.start_date::text          AS roster_start,
       c.start_date::text          AS board_start,
       c.contract_end_date::text   AS contract_end,
       (c.contract_end_date - CURRENT_DATE) AS days_until
FROM employees e
JOIN LATERAL (
  SELECT mc.*
  FROM monday_contracts mc
  WHERE mc.employee_id = e.id
    AND mc.deleted_on_monday = false
  ORDER BY mc.start_date DESC NULLS LAST
  LIMIT 1
) c ON true
WHERE e.active = true
  AND c.contract_end_date IS NOT NULL
ORDER BY c.contract_end_date;
```

## Query 3 — Ulla Hees, and anyone else with more than one live board row

```sql
SELECT mc.employee_name_raw,
       mc.board_group,
       mc.position,
       mc.state,
       mc.start_date::text        AS start_date,
       mc.contract_end_date::text AS contract_end_date,
       mc.employee_id
FROM monday_contracts mc
WHERE mc.deleted_on_monday = false
  AND (mc.employee_name_raw ILIKE '%Hees%'
       OR mc.employee_id IN (
         SELECT employee_id
         FROM monday_contracts
         WHERE deleted_on_monday = false AND employee_id IS NOT NULL
         GROUP BY employee_id
         HAVING count(*) > 1))
ORDER BY mc.employee_name_raw, mc.start_date;
```

## Query 4 — what the Position and State columns actually contain

```sql
SELECT COALESCE(NULLIF(TRIM(c.state), ''), '(blank)') AS state,
       count(*) AS employees
FROM employees e
JOIN LATERAL (
  SELECT mc.* FROM monday_contracts mc
  WHERE mc.employee_id = e.id AND mc.deleted_on_monday = false
  ORDER BY mc.start_date DESC NULLS LAST LIMIT 1
) c ON true
WHERE e.active = true
GROUP BY 1
ORDER BY employees DESC;
```

Report all four result sets in full. Do not summarise away rows. Do not write
any file.
