# Payroll, PTO and Contracts load only the payroll country

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

Employees now have `country` (default `'Panama'`) and config key `payroll_country` (= `Panama`).
Employees from other countries only use the Attendance tab. This prompt keeps them out of payroll,
the PTO tracker and Contracts. Attendance is not touched.

**Only these files may change:** `src/actions/loadEmployees.ts`,
`src/actions/loadPtoBalancesInputs.ts`, `src/actions/loadPtoUpcoming.ts`,
`src/actions/loadContractMilestones.ts`. **No other file may be touched.** `ProcessPayroll.tsx`
reads `loadEmployees` and must **not** be edited.

Rules:
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- Do not change any other condition, column or ordering in these queries.

The same line is added in every place. Copy it exactly:

```sql
        AND COALESCE(e.country, 'Panama') = COALESCE(NULLIF((SELECT c.value FROM classification_config c WHERE c.key = 'payroll_country'), ''), 'Panama')
```

## 1. `src/actions/loadEmployees.ts`
Directly after `WHERE e.active = TRUE AND e.excluded_from_payroll = FALSE`, add the line.

## 2. `src/actions/loadPtoBalancesInputs.ts`
Directly after `WHERE e.active = true`, add the line.

## 3. `src/actions/loadPtoUpcoming.ts`
There are **two** `AND e.active = true` lines. Directly after **each**, add the line (indent it
like the `AND e.active` line).

## 4. `src/actions/loadContractMilestones.ts`
Directly after `WHERE e.active = true`, add the line.

Reply with the diff of the four files.
