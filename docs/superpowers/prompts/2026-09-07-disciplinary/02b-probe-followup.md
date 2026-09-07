# Follow-up probe: which cases are actually overdue today?

**Write no files. Create nothing. Modify nothing. Delete nothing.**

Read-only, like `02-probe.md`. Do not create an action, page, component, lib
module or migration. Run the queries and report the results as tables.

## Why

The first probe found the latest action is dated **2026-08-19**, not
2026-06-30 as the design assumed. The design's acceptance criteria say *"every
open case is overdue today, so the nav badge equals the open count"* — that was
safe when every re-evaluation date was in June or July. With an action filed in
mid-August it may no longer be true, and the badge count is one of the things
being checked on screen.

## Query A — the re-evaluation spread

Against **`SAUL Disciplinary Action Forms DB`**, with today as `2026-09-07`:

```sql
SELECT
  count(*)                                                          AS actions,
  count(*) FILTER (WHERE revaluation_date <  DATE '2026-09-07')     AS overdue,
  count(*) FILTER (WHERE revaluation_date >= DATE '2026-09-07')     AS still_ahead,
  count(*) FILTER (WHERE revaluation_date <= DATE '2026-09-07' + 30) AS due_within_30,
  min(revaluation_date)::text                                       AS earliest_reval,
  max(revaluation_date)::text                                       AS latest_reval
FROM disciplinary_actions;
```

`due_within_30` is exactly what the nav badge will show, so **report it as the
expected badge number.**

## Query B — every action, ordered as the page will order them

```sql
SELECT id,
       employee_name,
       document_date::text    AS document_date,
       revaluation_date::text AS revaluation_date,
       warning_level,
       CASE
         WHEN revaluation_date IS NULL                  THEN 'open (no re-eval)'
         WHEN revaluation_date <  DATE '2026-09-07'     THEN 'overdue'
         ELSE 'open'
       END AS state_today
FROM disciplinary_actions
ORDER BY employee_name, document_date DESC, id DESC;
```

Report all 16 rows. This is the table the finished page is checked against, so
it needs to be exact.

## Query C — Timothy Moore's file, in page order

```sql
SELECT id, ref, document_date::text AS document_date,
       revaluation_date::text AS revaluation_date,
       warning_level, scenario
FROM disciplinary_actions
WHERE employee_name = 'Timothy Moore'
ORDER BY document_date DESC, id DESC;
```

He has four actions reaching Second Written Warning — the deepest escalation in
the data — so he is the row the finished page is demonstrated on. **Report his
four rows in this exact order**, and note that the case file will display them
reversed, oldest first.

## Query D — is any employee entirely inactive with an open case?

Against **`GAF Planilla DB`**:

```sql
SELECT display_name, active, role, manager
FROM employees
WHERE display_name IN ('Juan Molina', 'Osvaldo Medina');
```

Confirm both are `active = false` and report whether `role` and `manager` are
null. The page falls back to the disciplinary record's own role when the roster
has none, and these two are the live instances of that.

## Acceptance

1. No file was created, modified or deleted.
2. Query A's `due_within_30` is reported explicitly as **the number the nav
   badge should display**.
3. All 16 rows of Query B are listed with their `state_today`.
4. Timothy Moore's four actions are listed in order.
