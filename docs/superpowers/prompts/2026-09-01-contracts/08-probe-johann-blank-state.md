# Read-only: why is Johann Morante's State blank?

**This is a question, not a change. Do not edit, create or delete any file.**
Run the queries below against `GAF Planilla DB` and report each result as a
table. Change nothing. Do not "fix" anything you find.

Background: on the new Contracts page every active employee shows a State
(`Vitasya`, `GA`, `IN`, `PA`, `AZ`, `OH`, `GA West`, `GA East`) except **Johann
Morante**, who is blank. His Position, Start date and Contract end date are all
populated, so the board row itself is fine and the sync ran.

`state` is mirrored from the Employee Onboarding board column
`lookup_mktc2x46`, which is a **lookup/mirror column**. Those return empty text
when the item they mirror from is not linked. The question is whether the value
is missing **on the board** or lost **in our parsing**.

## Query 1 — who is blank, and is it only him?

```sql
SELECT mc.employee_name_raw,
       COALESCE(NULLIF(TRIM(mc.state), ''), '(blank)') AS state,
       COALESCE(NULLIF(TRIM(mc.position), ''), '(blank)') AS position,
       mc.board_group,
       mc.start_date::text        AS start_date,
       mc.contract_end_date::text AS contract_end_date,
       mc.synced_at::text
FROM monday_contracts mc
WHERE mc.deleted_on_monday = false
  AND (mc.state IS NULL OR TRIM(mc.state) = '')
ORDER BY mc.employee_name_raw;
```

## Query 2 — what the board actually sent us for that column

Compare Johann against someone whose State is populated. This reads the stored
raw payload, so it shows exactly what Monday returned at sync time.

```sql
SELECT mc.employee_name_raw,
       cv->>'id'    AS column_id,
       cv->>'type'  AS column_type,
       cv->>'text'  AS column_text,
       cv->>'value' AS column_value
FROM monday_contracts mc,
     jsonb_array_elements(mc.raw->'column_values') cv
WHERE mc.deleted_on_monday = false
  AND cv->>'id' = 'lookup_mktc2x46'
  AND (mc.employee_name_raw ILIKE '%Morante%'
       OR mc.employee_name_raw ILIKE '%Hees%'
       OR mc.employee_name_raw ILIKE '%Aloma%')
ORDER BY mc.employee_name_raw;
```

**Read this carefully.** If `column_text` is empty *and* `column_value` is empty
or null for Johann while both are populated for the others, the value is missing
on Monday and there is nothing to fix in our code. If `column_value` holds
something but `column_text` is empty, our parser is reading the wrong field.

## Query 3 — every column Monday sent for Johann's row

So we can see whether anything else is quietly empty too.

```sql
SELECT cv->>'id'   AS column_id,
       cv->>'type' AS column_type,
       COALESCE(NULLIF(cv->>'text', ''), '(empty)') AS column_text
FROM monday_contracts mc,
     jsonb_array_elements(mc.raw->'column_values') cv
WHERE mc.deleted_on_monday = false
  AND mc.employee_name_raw ILIKE '%Morante%'
ORDER BY 1;
```

## Query 4 — what the rest of the app knows about him

```sql
SELECT e.id, e.display_name, e.active,
       COALESCE(e.role, '(blank)')    AS role,
       COALESCE(e.manager, '(blank)') AS manager,
       e.teramind_email,
       e.start_date::text AS roster_start
FROM employees e
WHERE e.display_name ILIKE '%Morante%';
```

Report all four results in full. State plainly which of the two causes the
evidence supports — missing on the board, or mis-parsed by us. **Do not change
any file either way.**
