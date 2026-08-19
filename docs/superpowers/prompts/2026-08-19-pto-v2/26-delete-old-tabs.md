Delete seven files that nothing imports any more, and update one doc.

Files to delete:
- `src/app/pages/pto/BalancesTab.tsx`
- `src/app/pages/pto/BalancesRow.tsx`
- `src/app/pages/pto/ApprovalsTab.tsx`
- `src/app/pages/pto/ApprovalRow.tsx`
- `src/app/pages/pto/FloatingHolidaysTab.tsx`
- `src/actions/loadPtoApprovals.ts`
- `src/actions/loadFloatingHolidays.ts`

I have verified nothing else in `src/app` or `src/actions` imports any of them — the PTO Tracker is now one table (`PtoTracker.tsx` → `PtoTable.tsx`, `PtoRow.tsx`, `PtoBreakdown.tsx`) and reads `loadPtoBalancesInputs` and `loadPtoEmployeeDetail`.

File to modify: `src/AGENTS.md` — in the PTO section, replace the description of the three tabs with:

> `/pto` is one table (`PtoTracker.tsx` → `pto/PtoTable.tsx`, `PtoRow.tsx`, `PtoBreakdown.tsx`); a row expands into pending Monday requests, the recorded ledger (Edit / Withdraw) and floating holidays, loaded by `loadPtoEmployeeDetail`. `RecordApprovalDialog.tsx` has record / edit / manual modes; `recorded_by` is `'app'` for new rows.

No other file may change. Do not drop any table, remove any datasource, or touch any other action.
