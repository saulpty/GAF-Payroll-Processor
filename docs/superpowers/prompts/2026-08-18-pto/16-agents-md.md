Update `src/AGENTS.md` only. No other file may change.

1. Schema → replace the section "### Dead — do not build on these" with "### PTO ledger — live since 2026-08-18": `pto_approvals` is the PTO ledger (status pending|recorded|withdrawn, source monday|excel_import|manual, monday_item_id links to monday_requests); `pto_employees` holds manual facts (paid_pto_days, pto_start_date_override); `pto_floating_holidays` per employee-year. Balances are computed in the browser by `src/app/lib/ptoAccrual.ts` (Excel DAYS360/11); SQL never computes them. Keep the paragraph warning that `pto_days`/`pto_dates`/`pto_count` in `loadHrkSummary.ts` are unrelated CTE aliases.
2. Schema → add "### Monday mirror": `monday_requests`, `monday_attendance_forms`, `monday_contracts` (keyed by monday_item_id, employee_id nullable = unmatched, raw jsonb, deleted_on_monday, never deleted) and `monday_sync_log`. Synced from Admin → Employees → Monday tab. Payroll's own per-period Monday pull in ProcessPayroll is separate and unchanged.
3. Monday.com integration → the config table: add `monday_board_onboarding` and the `monday_col_requests_*`, `monday_col_attendance_details|eta`, `monday_col_onboarding_*` keys. Remove the "Two current violations" subsection: `loadEmployeeDirectory.ts` and `AdminEmployeeSync.tsx` no longer exist; the Directory sync lives in `src/app/pages/admin/employees/MondayTab.tsx` and reads every ID from config. Add: "Resolution of board rows to employees is `buildResolver` in `src/app/lib/mondayResolve.ts` — use it, do not write another matcher."
4. File map → Routes: add `/pto` (`PtoTracker.tsx`, tabs balances/approvals/floating) under a new **People** section; Admin children: `employees` is now `AdminEmployeesHub.tsx` with tabs roster/monday/aliases (components under `pages/admin/employees/`); remove `aliases` and `directory-sync` (redirects only). Actions list: add the new load/upsert/update actions by name. Libs: add `ptoAccrual.ts`, `mondayResolve.ts`.
5. Hard constraints → add: "New pages/components stay under 15 KB; one component per tab."

6. Monday.com integration → add a rule of its own, because it has already cost
   real time: **mirror/lookup columns return `text: null`.** Their value is in
   `display_value`, which the query must ask for with the inline fragment
   `... on MirrorValue { display_value }`. Reading `.text` alone yields blank
   strings with no error — the same silent-wrong-data shape as the
   manager-column incident. `colText` in
   `src/app/pages/admin/employees/mondaySync.ts` handles this; use it.

7. Monday.com integration → also record that the **Employee Onboarding board
   has no employee-email column**, so its rows resolve by name only. Eight
   active employees needed full-legal-name aliases (migration 1781803800)
   because that board stores "Eddy Miguel Cedeño Chavarría" where `employees`
   holds "Eddy Cedeño".

8. Timezone rules → add: **never use `new Date().toISOString().slice(0, 10)` to
   get "today".** That is the UTC date, and Panama is UTC−5 all year, so from
   19:00 local it returns tomorrow. Use `toLocalYMD(new Date())`. This shipped
   once in the Floating Holidays tab and was caught in review.

Two things that must NOT change, because `tests/agentsDoc.test.ts` asserts them:
keep top-level headings whose text includes Schema, Timezone, Classification,
File map and Hard constraints; and keep the mentions of ProcessPayroll,
PayrollMaster and classificationEngine as high-blast-radius files.

Keep the document's existing voice: direct, specific, and explaining *why* a
rule exists rather than only stating it.
