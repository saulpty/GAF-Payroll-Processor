# Payroll and PTO load only the payroll country

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

Employees now have `country` (default `'Panama'`) and config key `payroll_country` (= `Panama`).
This prompt keeps everyone whose country is not the payroll country out of payroll and out of the
PTO tracker (PTO uses Panama's accrual rule, so a balance for anyone else would be invented).
They stay in Attendance, Activity, Disciplinary and Contracts.

> DRAFT NOTE (remove before sending): the PTO half depends on Saul's answer to Q4 in the design
> doc. If he wants them in PTO, drop sections 2 and 3.

**Only these files may change:** `src/actions/loadEmployees.ts`,
`src/actions/loadPtoBalancesInputs.ts`, `src/actions/loadPtoUpcoming.ts`. **No other file may be
touched.** `ProcessPayroll.tsx` reads `loadEmployees` and must **not** be edited.

Rules:
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- Do not change any other condition, column or ordering in these queries.

The same condition is used in all three places. Copy it exactly:

```sql
COALESCE(e.country, 'Panama') = COALESCE(NULLIF((SELECT c.value FROM classification_config c WHERE c.key = 'payroll_country'), ''), 'Panama')
```

## 1. `src/actions/loadEmployees.ts`

The WHERE line becomes:

```sql
      WHERE e.active = TRUE AND e.excluded_from_payroll = FALSE
        AND COALESCE(e.country, 'Panama') = COALESCE(NULLIF((SELECT c.value FROM classification_config c WHERE c.key = 'payroll_country'), ''), 'Panama')
```

## 2. `src/actions/loadPtoBalancesInputs.ts`

Directly after the line `WHERE e.active = true`, add:

```sql
        AND COALESCE(e.country, 'Panama') = COALESCE(NULLIF((SELECT c.value FROM classification_config c WHERE c.key = 'payroll_country'), ''), 'Panama')
```

## 3. `src/actions/loadPtoUpcoming.ts`

There are **two** `AND e.active = true` lines (one per half of the UNION). Directly after **each**
of them, add the same line as in section 2 (same indentation as the `AND e.active` line).

Reply with the diff of the three files.
