# Proposed migrations — generated, not yet applied

SQL here has been generated locally but **not** run against the database, and
is not part of the UIB project. `src/migrations/` is a mirror of UIB's export;
nothing can be added there by hand. To apply one of these, paste it into a UIB
prompt as a new migration, the same way every other migration in this project
was applied.

## `seed_pto_from_excel.PROPOSED.sql`

Generated 2026-08-18 by `tools/pto-seed-from-xlsx.mjs` from
`PTO TRACKING GAF NEW.xlsx`. This is Task 15 of
`docs/superpowers/plans/2026-08-18-monday-mirror-and-pto-tracker.md`.

Contents: 45 `pto_employees` rows (paid PTO and start-date overrides),
48 `pto_approvals` rows (`source = 'excel_import'`, `status = 'recorded'`),
and 49 `pto_floating_holidays` rows for the current calendar year, covering 51
people.

Regenerated 2026-08-19 after a walkthrough with the owner found three problems
in the first version:

- A footnote row from the bottom of the Floating Holidays sheet ("📌 Column G
  (FH Used) is a manual entry…") was being read as an employee name. The
  generator now filters rows that are too long, contain symbols, or read like
  prose.
- The sheet says "Michael Jones"; `employees` holds "Michael Antonio Jones
  Roye". The generator now maps the sheet spelling to the stored name.
- **Johann Morante is deliberately excluded.** He was rehired in August 2026 and
  the owner decided on 2026-08-19 to treat him as a brand-new employee, so none
  of his pre-rehire history is imported. The omission and its reason are
  recorded in the SQL header itself, not just here.

**Read before applying:**

- It opens with a guard that collects every employee name in the sheet and
  raises `Unknown employees in sheet: ...` if any of them is absent from
  `employees`. Nothing is inserted in that case. This is deliberate — a silent
  NULL `employee_id` would produce a PTO row belonging to nobody.
- The sheet contains past employees (Natalia Esquivel, Veronica Vasquez,
  Diana Rodriguez, Samuel Duarte and others). All of those were confirmed
  present in `employees` as of 2026-08-19. If a future regeneration finds one
  missing, the guard will name them; decide per person whether to add them as
  inactive employees or add them to the generator's SKIP list with a reason.
- Employee ids are resolved by name at apply time, so no id is hardcoded and
  the file stays valid if ids change.
- It is **not** idempotent for `pto_approvals`: re-running would insert the
  historical rows a second time. Apply it exactly once. `pto_approvals` was
  empty as of 2026-08-18, which is the state it assumes.

**After applying,** open `/pto` with As-of `2026-08-11` and check these four
Available figures against the spreadsheet — they are the acceptance test:

| Employee | Available |
|---|---|
| Timothy Moore | 27.73 |
| Reggina Sandoval | 14.27 |
| Tanya Bedoya | 5.45 |
| Charles Bush | 0.18 |

If they match, the accrual, the ledger and the import all agree with the sheet
that has been the source of truth until now.
