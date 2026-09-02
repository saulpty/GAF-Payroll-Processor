# Merge employee 47 into 49, then delete 47

Saul has given explicit go-ahead. **Create exactly one new migration file under
`src/migrations/`.** No other file may be created or modified. Do not touch any
page, action, or `tenure.ts`. Do not run a sync.

## The situation

`employees` holds the same person twice:

| id | email | active | payroll rows (live) | monday_contracts | pto_employees | name_aliases |
|---|---|---|---|---|---|---|
| **47** | `javierqvistgaard@hotmail.com` | false | **10**, all `Q2-Jul-2026` | 1 | 1 | 0 |
| **49** | `javier.g@passiontocarehc.com` | true | 30 | 0 | 1 | 1 |

**49 survives.** 47's history moves to it, then 47 is deleted.

`payroll_entries.employee_id` and `name_aliases.employee_id` are
`NOT NULL REFERENCES employees(id)` with no `ON DELETE`, so the final delete
fails unless everything has moved. **That is a safety net — do not work around
it.**

## Step 1 — report the collision check BEFORE applying anything

Both records may hold a row for the same day. Moving one onto the other would
duplicate a payroll day.

```sql
SELECT p47.period_name, p47.work_date, p47.id AS id_47, p49.id AS id_49
FROM payroll_entries p47
JOIN payroll_entries p49
  ON p49.employee_id = 49
 AND p49.period_name = p47.period_name
 AND p49.work_date   = p47.work_date
WHERE p47.employee_id = 47
ORDER BY p47.work_date;
```

Also show both PTO rows so nothing is silently dropped:

```sql
SELECT employee_id, pto_start_date_override::text, paid_pto_days
FROM pto_employees WHERE employee_id IN (47, 49) ORDER BY employee_id;
```

**Report both results in your reply.** If the collision query returns rows, the
migration below leaves those specific entries on 47, the final `DELETE` fails,
and the whole transaction rolls back — which is the correct outcome. **Say so
and stop; do not force it.**

## Step 2 — the migration

One transaction. If any statement fails, the whole thing must roll back.

```sql
BEGIN;

-- Payroll: move only days 49 does not already have.
UPDATE payroll_entries pe
SET employee_id = 49
WHERE pe.employee_id = 47
  AND NOT EXISTS (
    SELECT 1 FROM payroll_entries x
    WHERE x.employee_id = 49
      AND x.period_name = pe.period_name
      AND x.work_date   = pe.work_date
  );

-- Aliases and the three Monday mirrors.
UPDATE name_aliases            SET employee_id = 49 WHERE employee_id = 47;
UPDATE monday_contracts        SET employee_id = 49 WHERE employee_id = 47;
UPDATE monday_requests         SET employee_id = 49 WHERE employee_id = 47;
UPDATE monday_attendance_forms SET employee_id = 49 WHERE employee_id = 47;

-- PTO: 49's row wins, but carry over anything only 47 has.
UPDATE pto_employees a
SET pto_start_date_override = COALESCE(a.pto_start_date_override, b.pto_start_date_override),
    paid_pto_days           = COALESCE(NULLIF(a.paid_pto_days, 0), b.paid_pto_days)
FROM pto_employees b
WHERE a.employee_id = 49 AND b.employee_id = 47;

DELETE FROM pto_employees WHERE employee_id = 47;
DELETE FROM pto_approvals WHERE employee_id = 47;   -- expected 0 rows

-- Only succeeds if nothing references 47 any more.
DELETE FROM employees WHERE id = 47;

COMMIT;
```

Header comment must record: what was merged, the row counts above, that Saul
authorised it on 2026-09-01, and that `Q2-Jul-2026` is an already-paid period
whose 10 rows were **re-attributed, not deleted** — the totals for that period
are unchanged, they now sit under employee 49.

**Rollback line:** note honestly that this is **not reversible** — once 47 is
gone the original attribution cannot be reconstructed from the data alone.

## Step 3 — verify and report

```sql
SELECT id, display_name, active, teramind_email
FROM employees WHERE display_name ILIKE '%Euclides%' ORDER BY id;

SELECT 'payroll_entries' AS t, count(*) FILTER (WHERE employee_id=47) AS on_47,
                              count(*) FILTER (WHERE employee_id=49) AS on_49
FROM payroll_entries
UNION ALL SELECT 'monday_contracts', count(*) FILTER (WHERE employee_id=47),
                                     count(*) FILTER (WHERE employee_id=49)
FROM monday_contracts
UNION ALL SELECT 'pto_employees', count(*) FILTER (WHERE employee_id=47),
                                  count(*) FILTER (WHERE employee_id=49)
FROM pto_employees;

SELECT period_name, count(*) AS rows
FROM payroll_entries WHERE employee_id = 49 AND deleted_at IS NULL
GROUP BY period_name ORDER BY period_name;
```

Expected: exactly one Euclides (id 49); `on_47` zero everywhere; and
`Q2-Jul-2026` now present under 49 with the 10 rows that were on 47.
