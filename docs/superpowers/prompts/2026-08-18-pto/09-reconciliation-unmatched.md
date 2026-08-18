Below the four sync cards on the Employees hub Monday tab, add (1) a reconciliation table comparing our `employees` rows to the Monday directory, and (2) an Unmatched list with an inline "Add alias" control.

Files that may be created: `src/actions/loadDirectoryReconciliation.ts`, `src/actions/loadMondayUnmatched.ts`, `src/app/pages/admin/employees/ReconciliationTable.tsx`, `src/app/pages/admin/employees/UnmatchedList.tsx`.
Files that may be modified: `src/app/pages/admin/employees/MondayTab.tsx` (render the two components; pass it a `refreshKey` that increments after any sync so they reload).
No other file may change.

## Where does the directory mirror come from?
The Directory card (previous step) writes into `employees` directly and does not keep a mirror table. For reconciliation, have the Directory card additionally keep its last pulled items in component state and pass them to `ReconciliationTable` as a prop `mondayDirectory: { item_id: string; name: string; email: string; role: string; manager: string; active: string }[]` (empty until the operator presses Sync now on Directory; show "Press Sync now on Directory to compare" in that case). Do NOT create a new table for this.

## loadDirectoryReconciliation (SQL, `GAF Planilla DB`)
```sql
SELECT id AS employee_id, display_name, teramind_email, role, manager, active
FROM employees
WHERE ({{params.manager}} IS NULL OR {{params.manager}} = '' OR manager = {{params.manager}})
ORDER BY display_name
```

## ReconciliationTable.tsx
- Props: `employees` (from `loadDirectoryReconciliation`), `mondayDirectory` (from the Directory card), `resolver` (the tab's resolver).
- For each employee find its Monday row (by email → alias → name using the resolver on the Monday rows). Columns: Employee · Email ✅/⚠️ · Role ✅/⚠️ · Manager ✅/⚠️ · Active ✅/⚠️ · Monday? (✅ found / ❌ not on board). A ⚠️ cell shows both values on hover (`title` attribute) — "ours: X · Monday: Y". Filter chips: All / Only mismatches / Not on Monday. A count line: "N employees · M mismatches · K not on Monday".
- Read-only. Fixing is done via Sync now (role/manager/active) or the Roster tab (email).

## loadMondayUnmatched (SQL)
```sql
SELECT 'requests' AS source, monday_item_id, employee_name_raw, employee_email_raw, board_group, synced_at FROM monday_requests WHERE employee_id IS NULL AND deleted_on_monday = false
UNION ALL
SELECT 'attendance_forms', monday_item_id, employee_name_raw, employee_email_raw, board_group, synced_at FROM monday_attendance_forms WHERE employee_id IS NULL AND deleted_on_monday = false
UNION ALL
SELECT 'contracts', monday_item_id, employee_name_raw, employee_email_raw, board_group, synced_at FROM monday_contracts WHERE employee_id IS NULL AND deleted_on_monday = false
ORDER BY employee_name_raw, source
```

## UnmatchedList.tsx
- Groups rows by `employee_name_raw` (+ email). Each group shows the name, email, which boards it appears on, and a row count.
- Inline control per group: an employee combobox (from `loadAllEmployees`, active first) and an **Add alias** button. On click: call the existing `saveNameAlias` action with `alias_text = employee_name_raw` and the chosen `employee_id` (use the same param names `saveNameAlias` already takes — read `src/actions/saveNameAlias.ts`), then show "Alias saved — press Sync now on the affected board(s) to re-match" and remove the group from the list. Do not try to update the mirror rows directly.
- Empty state: "Everything on the boards matches an employee."

Acceptance:
- After a Directory sync, the reconciliation table lists every active employee and the mismatch count is plausible (spot-check two ⚠️ cells against Monday).
- The Unmatched list shows the same total as the sum of the three cards' unmatched counts.
- Adding an alias for one unmatched name and re-syncing that board reduces the unmatched count by that name's row count and the rows now have `employee_id` set (`SELECT count(*) FROM monday_requests WHERE employee_id IS NULL`).
- Only the files named above changed.

## Exact action signature — use this, do not guess
`saveNameAlias` takes exactly `{ aliasText, employeeId }`:
`INSERT INTO name_aliases (alias_text, employee_id) VALUES ({{params.aliasText}}, {{params.employeeId}}::bigint) ON CONFLICT (alias_text) DO UPDATE SET employee_id = EXCLUDED.employee_id;`
So call it as `saveAlias({ aliasText: <the raw Monday name>, employeeId: <chosen id> })`.

## REQUIRED: suggest a likely employee for each unmatched row

This is grounded in what the first real sync actually produced, not a
hypothetical. Ten Onboarding rows failed to match, and eight of them are
current active staff whose board row carries the full legal name:

  Luis Felipe Abad Lemos            -> Luis Abad
  Navvad Afua Owusu Biamah          -> Navvad Owusu
  Tanya Thatiana Bedoya Ledezma     -> Tanya Bedoya
  Arelis Yaneth Acosta Jiron        -> Arelis Acosta
  Monique Alexandra Luque Valdonedo -> Monique Luque
  Eduardo Antonio Herrera Reyes     -> Eduardo Herrera
  Jose Eduardo De Hermoso Mendoza   -> Jose De Hermoso
  Eddy Miguel Cedeno Chavarria      -> Eddy Cedeno

Every one of these contains the roster name's tokens as a subset. So compute a
suggestion for each unmatched group:

- Normalize both sides with `normalizeName` from `@/app/lib/classificationEngine`
  (strips accents, lowercases, collapses whitespace), then split into tokens.
- Score each active employee by how many of that employee's name tokens appear
  in the unmatched name's token set. Require the employee's FIRST token to be
  present, and at least 2 tokens matching overall.
- The best-scoring employee, if unique at that score, is the suggestion.
  If there is a tie, or nothing clears the bar, show no suggestion.

Render the suggestion as a pre-selected value in the employee combobox with a
subtle "suggested" chip beside it, so the operator confirms with one click.
**Never save an alias automatically.** The operator must press Add alias. This
is the same discipline as the add-missing-employees dialog: propose, never act.

Also show, per unmatched group, which boards it appears on and how many rows —
one person unmatched on three boards is a different problem from one stray row.

## Two facts confirmed with the owner — reflect them in the copy
- **Timothy Moore is a manager whose data is deliberately not tracked.** He
  will always be unmatched and that is correct, not an error. Offer a way to
  mark a group as "ignore" so it stops being surfaced: insert nothing, just
  keep a local dismissed list in component state for the session, and label the
  control "Not an employee - hide".
- Current headcount is 45: 44 on the Panama directory plus one onboarded who is
  not on it yet. Unmatched rows are therefore expected to be a small handful,
  not a large set. If the unmatched list is ever long, that is a signal
  something is wrong with matching rather than with the data.
