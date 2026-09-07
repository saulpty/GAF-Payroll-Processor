# Capture Timothy Moore's four rows before they are deleted

**Write no files. Create nothing. Modify nothing. Delete nothing.** Read-only.

## Why

Saul has identified all four Timothy Moore disciplinary actions as **test
records he created himself** while trying out the form app, and asked for them
to be deleted. They were filed by "Saul Fallenbaum", which is consistent.

Deleting rows is irreversible, so their content is being recorded first. This is
not doubt about the instruction — it is so that if one of them turns out to
matter, it can be re-entered.

## The query

Against **`SAUL Disciplinary Action Forms DB`**:

```sql
SELECT id, ref,
       manager_name, manager_email,
       employee_name, employee_role, employee_branch,
       document_date::text     AS document_date,
       revaluation_date::text  AS revaluation_date,
       warning_level, final_outcome, scenario,
       left(q_expected, 200)   AS q_expected,
       left(q_happened, 200)   AS q_happened,
       q_when,
       left(q_impact, 200)     AS q_impact,
       evidence_types,
       left(expectations, 200) AS expectations,
       left(consequences, 200) AS consequences,
       prior_warnings,
       signature_drawn,
       (pdf_en_base64 IS NOT NULL) AS has_pdf_en,
       (pdf_es_base64 IS NOT NULL) AS has_pdf_es,
       submitted_at::text      AS submitted_at
FROM disciplinary_actions
WHERE employee_name = 'Timothy Moore'
ORDER BY id;
```

**Do not select `pdf_en_base64` or `pdf_es_base64` themselves** — each is
roughly 250 KB of base64. The booleans record only whether a PDF exists.

## Also confirm the blast radius

```sql
SELECT
  (SELECT count(*) FROM disciplinary_actions)                                      AS total_now,
  (SELECT count(*) FROM disciplinary_actions WHERE employee_name = 'Timothy Moore') AS timothy_rows,
  (SELECT count(DISTINCT employee_name) FROM disciplinary_actions)                  AS employees_now,
  (SELECT count(*) FROM disciplinary_actions WHERE employee_name <> 'Timothy Moore'
     AND warning_level = 'Second Written Warning')                                  AS other_second_written;
```

Expected: 16 total, 4 of them Timothy's, 10 employees, and **0** other Second
Written Warnings — his are the only ones, so deleting them removes that level
from the data entirely.

## Report

The four rows as a table, then the counts. Nothing else.

## Acceptance

1. No file was created, modified or deleted.
2. All four rows are reported with their ids and refs.
3. The counts are reported, including whether any other Second Written Warning
   exists.
