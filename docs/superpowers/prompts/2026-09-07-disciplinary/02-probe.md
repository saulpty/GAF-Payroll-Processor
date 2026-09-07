# Read-only probe: what is actually in `disciplinary_actions`

**Write no files. Create nothing. Modify nothing. Delete nothing.**

This is a **read-only investigation**. Do not create an action, a page, a
component, a migration or a lib module. Do not "helpfully" start building the
viewer. Run the queries below and report the results as tables in your reply.

If you believe a query needs a new saved action to run, say so and stop rather
than creating one.

## Why

A read-only Disciplinary Actions viewer is about to be built in this app. Its
design was written before the live data was seen. This probe checks the design
against reality **before** any UI exists, because three of its assumptions could
each be wrong in a way that would only surface as a broken page.

## The two databases

- **`SAUL Disciplinary Action Forms DB`** — holds `disciplinary_actions`. Newly
  connected. The other app that writes to it calls the same database
  `SAUL GA Offer Letter DB`, so **the first thing to confirm is which name a
  `datasourceName` in this app must use.**
- **`GAF Planilla DB`** — this app's own database, holding `employees` and
  `name_aliases`.

They are **separate Postgres instances**, so no query may join across them. Run
the disciplinary queries against the first and the employee queries against the
second, and compare the two result sets by hand in your report.

---

## Query 1 — the datasource, and the shape of the table

Against the disciplinary datasource. Report the **exact `datasourceName` string**
that worked.

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'disciplinary_actions'
ORDER BY ordinal_position;
```

**Gate:** `closed_at`, `closed_by` and `closure_note` must be present. If they
are not, migration `01-form-app-migration.md` has not been applied to this
database — stop and report that, and do not continue.

## Query 2 — how much data there is

```sql
SELECT count(*)                            AS actions,
       count(DISTINCT employee_name)       AS employees,
       count(DISTINCT manager_name)        AS managers,
       min(document_date)::text            AS earliest,
       max(document_date)::text            AS latest,
       count(*) FILTER (WHERE revaluation_date IS NULL) AS no_reval,
       count(*) FILTER (WHERE closed_at IS NOT NULL)    AS already_closed
FROM disciplinary_actions;
```

The design expects roughly **7 actions across 5 employees**, 0 with no
re-evaluation date, and 0 already closed. Report the real numbers; if they
differ, the real numbers win.

## Query 3 — every employee named, and every manager

```sql
SELECT employee_name, employee_role, employee_branch,
       count(*)                      AS actions,
       max(document_date)::text      AS latest_action,
       string_agg(DISTINCT warning_level, ' | ') AS levels
FROM disciplinary_actions
GROUP BY employee_name, employee_role, employee_branch
ORDER BY employee_name;
```

```sql
SELECT DISTINCT manager_name, manager_email
FROM disciplinary_actions
ORDER BY manager_name;
```

## Query 4 — the values that will drive the chips

```sql
SELECT warning_level, count(*) FROM disciplinary_actions
GROUP BY warning_level ORDER BY 2 DESC;
```

```sql
SELECT COALESCE(NULLIF(final_outcome, ''), '(none)') AS final_outcome, count(*)
FROM disciplinary_actions GROUP BY 1 ORDER BY 2 DESC;
```

```sql
SELECT scenario, count(*) FROM disciplinary_actions
GROUP BY scenario ORDER BY 2 DESC;
```

```sql
SELECT DISTINCT unnest(evidence_types) AS evidence_type
FROM disciplinary_actions ORDER BY 1;
```

The viewer expects these value sets, taken from the form app's own option lists:

- **warning_level** — Verbal Warning, First Written Warning, Second Written
  Warning, Final Written Warning
- **final_outcome** — empty, Suspension, Termination
- **scenario** — Operational Instructions, Calls / Lead Follow-up,
  Attendance / Tardiness, Inappropriate Conduct, Misuse of Systems / Tools
- **evidence_types** — Call Report, Monday.com, Attendance Record, Email / Chat,
  Witnesses, Other

**Report any value that is not on these lists.** Nothing in the schema enforces
them, so an unexpected string is entirely possible and the page must not branch
on values it has never seen.

## Query 5 — how the same-day tie is broken

```sql
SELECT id, ref, employee_name, document_date::text, submitted_at::text
FROM disciplinary_actions
WHERE employee_name = 'Juan Molina'
ORDER BY document_date DESC, id DESC;
```

Two of his actions are expected to share a `document_date` of 2026-06-16.
**Report their `id` and `submitted_at` values.** The viewer orders an employee's
file by `document_date DESC, id DESC`, and this confirms the ids actually
separate them.

## Query 6 — do the names resolve to real employees?

**This is the gate that matters most.** The disciplinary table has no employee
id and no email, only a free-text `employee_name`. The viewer matches those
names against the roster in React. A name that does not match is displayed with
a *"not on roster"* chip rather than dropped — but every such name must be known
about **now**, not discovered on screen.

Against **`GAF Planilla DB`**:

```sql
SELECT id, display_name, role, manager, active
FROM employees
WHERE display_name IN (
  'Eduardo Herrera', 'Osvaldo Medina', 'Aleka Papatsoris',
  'Juan Molina', 'Navvad Owusu'
)
ORDER BY display_name;
```

Replace that name list with **the actual distinct names from Query 3** if they
differ.

```sql
SELECT a.alias_text, a.employee_id, e.display_name
FROM name_aliases a
JOIN employees e ON e.id = a.employee_id
WHERE a.alias_text ILIKE ANY (ARRAY[
  '%Herrera%', '%Medina%', '%Papatsoris%', '%Molina%', '%Owusu%'
])
ORDER BY a.alias_text;
```

Then report, as a table, one row per distinct disciplinary `employee_name`:

| employee_name | matches an `employees.display_name`? | matches a `name_aliases.alias_text`? | `employees.active` | roster `role` vs the form's `employee_role` |
|---|---|---|---|---|

**Name every unmatched name explicitly.** Also flag any employee whose roster
`role` disagrees with the `employee_role` stored on the action — the form
captured the role at the time it was filed, so a disagreement is expected and
harmless, but the viewer prefers the roster value and it should be known which
rows will change appearance.

## Query 7 — inactive employees

```sql
SELECT display_name, active, end_date::text
FROM employees
WHERE display_name IN ( /* the same name list */ )
ORDER BY active, display_name;
```

Saul's decision is that **everyone with a record appears, active or not**, with
inactive employees rendered muted. Report how many of the named employees are
inactive, so the page's muted rows are expected.

---

## What to report

A markdown reply with one section per query, results as tables. End with a
short list headed **"What this changes about the design"** — any assumption
above that the data contradicted. If the data matches the design everywhere,
say that explicitly.

## Acceptance

1. No file was created, modified or deleted anywhere in the project.
2. Every query above ran, or the reply says exactly why one could not.
3. The three closure columns are confirmed present (Query 1 gate).
4. Every distinct `employee_name` is listed with its match status.
5. Any value outside the four expected value sets is called out by name.
