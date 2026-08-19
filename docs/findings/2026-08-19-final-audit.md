# Final audit of the Monday mirror + PTO tracker — 2026-08-19

Scope: code, logic and UX of everything built 2026-08-18/19 (Tasks 1–16 plus
the duplicate-row fix). Ranked by what would actually hurt, not by effort.
Nothing here is a payroll risk — payroll never reads any of these tables.

## Findings

### 1. The Approvals ledger has no Edit, Withdraw or Add-manually — spec §6.2 gap
**Where:** `src/app/pages/pto/ApprovalsTab.tsx`.
**What:** the ledger table only displays rows. The Record dialog works for
pending Monday requests and Dismiss exists, but there is no way in the UI to
correct a recorded row, withdraw one, or record leave that never came through
the Monday form. `updatePtoApprovalStatus` exists as an action and **nothing
calls it** — it is dead code today.
**Why it matters:** the whole point of the ledger-not-mirror design was that
Tim corrects rows after the fact ("employees often take different days than
requested"). Without Edit, a wrong recorded row can only be fixed in the
database. This is the most important gap.
**Fix:** add Edit (opens the dialog pre-filled with the row), Withdraw (calls
`updatePtoApprovalStatus` with `withdrawn`, with confirm), and Add manually
(dialog with `source = 'manual'`, no `monday_item_id`). Small, one prompt.

### 2. `upsertPtoApproval` cannot update a row that has no `monday_item_id`
**Where:** `src/actions/upsertPtoApproval.ts`.
**What:** the upsert conflicts on `monday_item_id` only. A manual or
Excel-imported row has none, so "editing" it would INSERT a duplicate rather
than update in place. Today this cannot trigger — because of finding 1 — but
the moment Edit is added it will.
**Fix:** do it together with finding 1. Either accept an optional `id` and use
`INSERT … ON CONFLICT (id) DO UPDATE` (with `OVERRIDING SYSTEM VALUE` if the
identity rejects explicit ids), or add a separate `updatePtoApproval` action
keyed on `id`. The second is cleaner.

### 3. Two `load*` actions lack the `manager` filter — spec Global Constraint
**Where:** `loadPendingPtoRequests`, `loadPtoApprovals`.
**What:** every new `load*` was to accept an optional `manager` param so roadmap
G (manager-scoped access) becomes a wiring job. These two — precisely the ones a
manager would need scoped — don't. `loadPtoBalancesInputs`,
`loadFloatingHolidays` and `loadDirectoryReconciliation` do.
**Fix:** add `AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR
e.manager = {{params.manager}})` to both, joining `employees e` where needed.
Pure addition; no caller passes it yet.

### 4. Record dialog does not reject return-before-leave
**Where:** `src/app/pages/pto/RecordApprovalDialog.tsx:75`.
**What:** it validates `total_days > 0` but not `return_on >= leave_on`. If the
dates are reversed, `defaultTotalDays` goes negative, which trips the positive
check — so it is caught *indirectly* for the auto-filled case, but a user who
hand-edits Total days to a positive number can still save reversed dates.
**Fix:** one explicit check with a clear message. Trivial.

### 5. Add-missing-employees dialog lists a duplicated person twice
**Where:** `syncDirectory.ts:126` (`newCandidates.push`).
**What:** candidates are collected per board row, so Johann Morante (two rows,
same email) appears twice. Ticking both would create two employees sharing one
email. Low risk while he is skipped; real once a rehire is added this way.
**Fix:** de-duplicate `newCandidates` by lower-cased email, preferring the row in
the current group. Tiny.

### 6. De-duplication path unproven against a real duplicate
**Where:** `syncDirectory.ts` `deduplicateByEmployee`.
**What:** correct by inspection, verified "0 updated" on live data, but has not
run for an employee with two rows because Johann is not in `employees` yet.
**Action:** none now. When Johann is added, the first sync should report
"1 duplicate row collapsed" and leave him active. If it doesn't, this is where
to look.

## What held up well

- **Every number reconciles.** Accrual matches the spreadsheet to four decimals
  at its frozen date; the seeded ledger reproduces Available for all four
  acceptance rows; Charles Bush's live 0.91 is the sheet's 0.18 plus eight days.
- **No hardcoded Monday ids anywhere,** enforced by H4/H5 going forward.
- **Loading / empty / error states present on all three PTO tabs** and the
  Monday cards.
- **Negative Available shows red; the 6-month paid-PTO hint fires** from
  `days360 >= 180`, as designed.
- **No `Date` arithmetic on date strings** — the one instance (UTC "today" in
  Floating Holidays) was caught and fixed before it shipped.
- **Every file under 15 KB**, `PtoTracker.tsx` 2.4 KB, `MondayTab.tsx` shrank
  while gaining three boards.
- **Payroll untouched throughout** — the six high-blast-radius files were never
  edited; one of them (`AdminEmployeeSync.tsx`) was replaced and deleted.

## Recommended next prompt

One change, in this order, because 1 and 2 must land together: add Edit /
Withdraw / Add-manually to the ledger with an `updatePtoApproval` action keyed
on `id`; add the `return_on >= leave_on` check while in the dialog; add the
`manager` param to the two loads; de-duplicate the add-missing candidates.
Four small edits, one export, one diff.
