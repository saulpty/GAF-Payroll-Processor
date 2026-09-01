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

---

# Result — run 2026-09-01

Verified read-only: exported straight after and `sync-export` reported
`added: 0, changed: 0, removed: 0` against a genuinely new zip, `git status`
clean. The agent read files and executed SQL; it wrote nothing.

## Query 1 — coverage

| Metric | Count |
|---|---|
| active_employees | 44 |
| null_roster_start | 0 |
| with_board_row | 44 |
| no_board_row | 0 |
| with_end_date | **44** |
| end_date_future | **13** |
| ending_within_30 | **1** |
| end_date_past | 31 |
| start_date_mismatch | 0 |

**The gate is passed.** Contract end coverage is 100%, and 13 are still ahead of
us. The countdown is worth building.

## Query 2 — the one that matters today

**Carlos Aloma, Intake 1, GA — contract ends 2026-09-02. That is tomorrow.**
It is the only one inside 30 days, so the nav badge will read exactly `1`.

The next four: Winston Carrillo 2026-12-08 (+98), Eder Quintero 2026-12-15
(+105), Isaac Chung 2027-01-06 (+127), then a cluster of six on 2027-01-20/21.

Recently ended, all correctly muted rather than flagged: Charles Bush, Aleka
Papatsoris and Karhid Arevalo on 2026-08-24 (-8), Alanis Chena 2026-08-02 (-30).

**Every contract is exactly start + 6 months.** No exceptions in 44 rows.

## Query 3 — Ulla Hees, and rehires

| name | board_group | position | state | start | contract_end |
|---|---|---|---|---|---|
| Ulla Hees | 6 Months - 1 Year | DevOps Engineer & Engineering Manager | Vitasya | 2025-11-19 | 2026-05-19 |

**One row, not several.** Her contract end has already passed, so she is the
worked example for the *muted `ended`* case, not for a live countdown.

**Nobody has two live board rows.** The latest-start-wins rule stays in as a
defence, but it changes nothing today.

Also noted, not used: `board_group` carries a tenure bucket — `6 Months - 1 Year`.
Already mirrored. Out of scope here; a candidate for Employee 360.

## Query 4 — `state` is not employment status

| state | employees |
|---|---|
| Vitasya | 16 |
| GA | 8 |
| IN | 5 |
| GA West | 4 |
| GA East | 4 |
| PA | 3 |
| AZ | 2 |
| OH | 1 |
| (blank) | 1 |

**It is a region / operating entity, not Active-vs-Inactive.** The spec's
example row showed `Active` under State and that was wrong. The column stays —
it is useful — but nothing may read it as a status.

## What this changes in the spec

1. **`State` is a region.** Fix the example; never treat it as employment status.
2. **Five edge cases have zero live instances** — no board row, blank contract
   end, null roster start, start-date mismatch, duplicate board rows. Keep the
   defensive handling; drop them from live acceptance and cover them in unit
   tests instead. The header line "N employees not on the Onboarding board" will
   read 0 and should therefore render nothing at all.
3. **Worked examples become:** Carlos Aloma = red chip, `in 1 d`.
   Ulla Hees = muted `ended 05-19-2026`. Badge = `1`.
