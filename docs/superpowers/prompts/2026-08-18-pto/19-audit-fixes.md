Four small, related fixes from a code audit. They land together because the first two depend on each other.

Files that may be created: `src/actions/updatePtoApproval.ts`.
Files that may be modified: `src/actions/loadPendingPtoRequests.ts`, `src/actions/loadPtoApprovals.ts`, `src/app/pages/pto/ApprovalsTab.tsx`, `src/app/pages/pto/RecordApprovalDialog.tsx`, `src/app/pages/admin/employees/syncDirectory.ts`.
No other file may change. Do NOT modify `upsertPtoApproval.ts`, `ptoAccrual.ts`, any migration, or anything under `src/components/ui/`.

## 1. The ledger needs Edit, Withdraw and Add manually

Today the Approvals ledger table only displays rows. The design is that `pto_approvals` is the record of what Tim actually decided, which means he must be able to correct it after the fact. Add three controls.

**New action `src/actions/updatePtoApproval.ts`** — SQL, datasource `GAF Planilla DB`, keyed on the row's own id. It must NOT use `upsertPtoApproval`, which conflicts on `monday_item_id` only and would insert a duplicate for any manual or Excel-imported row (those have no `monday_item_id`):

```sql
UPDATE pto_approvals
SET employee_id  = {{params.employee_id}}::bigint,
    leave_on     = {{params.leave_on}}::date,
    return_on    = {{params.return_on}}::date,
    total_days   = {{params.total_days}}::numeric,
    gaf_comments = {{params.gaf_comments}},
    recorded_by  = {{params.recorded_by}},
    updated_at   = NOW()
WHERE id = {{params.id}}::bigint
```

**`RecordApprovalDialog.tsx`** — generalise it so it can open in three modes without duplicating the form:
- *record* (existing): from a pending Monday request; saves via the existing `upsertPtoApproval` with `status = 'recorded'`, `source = 'monday'`.
- *edit*: opened with an existing ledger row (it has an `id`); the employee is shown read-only; Save calls the new `updatePtoApproval` with that `id`. Do not change `status` or `source` on edit.
- *manual*: opened empty; employee chosen from a combobox of active employees (`loadAllEmployees`, active first); Save calls `upsertPtoApproval` with `status = 'recorded'`, `source = 'manual'`, `monday_item_id = null`.
Keep the Total days pre-fill from `defaultTotalDays` in all modes, still editable.

**`ApprovalsTab.tsx`** — on each ledger row add **Edit** (opens the dialog in edit mode) and, for rows whose status is `recorded`, **Withdraw** (confirm, then call the existing `updatePtoApprovalStatus` with `{ id, status: 'withdrawn' }`, then reload). Add an **Add manually** button next to the Refresh button that opens the dialog in manual mode. After any save, reload both the pending list and the ledger, as Record already does.

## 2. Reject return-before-leave explicitly

In `RecordApprovalDialog.tsx`, before the existing "Total days must be a positive number" check, add: if `return_on < leave_on` (plain string comparison on `YYYY-MM-DD` — never construct a `Date`), show `Return date must be on or after the leave date.` and do not save. Today this is only caught indirectly when the auto-filled day count goes negative; a user who hand-edits Total days can still save reversed dates.

## 3. Add the `manager` filter to two load actions

Every `load*` in this feature takes an optional `manager` param so manager-scoped access can be wired later without touching SQL. Two were missed. Add to both, joining `employees e` on `employee_id` where not already joined:

```sql
AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
```

- `loadPendingPtoRequests.ts` — it already LEFT JOINs `employees e`.
- `loadPtoApprovals.ts` — it joins `employees e` already.

No caller passes `manager` yet, so pass `manager: null` from `ApprovalsTab` where these are called, and behaviour is unchanged.

## 4. De-duplicate the add-missing-employees candidates

In `syncDirectory.ts`, `newCandidates` is filled once per board row, so a rehire with two rows (one in Current Employees, one in Past employees, same email) appears twice in the dialog; ticking both would create two employees sharing an email. Before presenting candidates, de-duplicate by lower-cased email, keeping the row whose `group.id` equals `monday_group_directory_current` if there is one, otherwise the first seen.

## Constraints
- Dates are `YYYY-MM-DD` strings; compare and display them as strings. No `new Date(...)` on them, no locale formatting.
- No Monday board, column or group id anywhere (tests H4/H5).
- Files stay under 15 KB; if `ApprovalsTab.tsx` (9.3 KB now) would exceed that, split the ledger row into `src/app/pages/pto/ApprovalRow.tsx` — that file is then also allowed.

## Acceptance
- Ledger rows show Edit, and Withdraw on recorded rows; Add manually appears by Refresh.
- Editing an Excel-imported row (one with `source = 'excel_import'` and no `monday_item_id`) and saving changes that row in place: `SELECT count(*) FROM pto_approvals` is unchanged afterwards.
- Withdraw sets `status = 'withdrawn'` and the employee's Taken on Balances drops by that row's days.
- Reversed dates are rejected with the message above.
- `loadPendingPtoRequests` and `loadPtoApprovals` each contain `params.manager`.
- The add-missing dialog lists each email once.
