# 02 — Contracts: remove the 30d / 60d / 90d buttons

## Files you may change

- `src/app/pages/Contracts.tsx`
- `src/app/pages/contracts/ContractsTable.tsx`

**No other file may be touched.**

## Contracts.tsx

Remove `DUE_OPTIONS`, the `dueWithin` state, the whole "Due-within toggle"
`<div role="group">` block in `actions`, and the `dueWithin` prop passed to
`<ContractsTable>`. The count summary, the Export button and the off-board notice
stay exactly as they are.

## ContractsTable.tsx

Remove `dueWithin` from `Props`, from the destructured props, from the filter
`useMemo` (the `if (dueWithin !== null) …` block and the dependency), and nothing
else. Employee and role filtering, sorting, counts and the empty state are unchanged.

## Verify

- `/contracts` header shows "45 employees" and Export; no 30d/60d/90d buttons.
- Row count and default order identical to before.
- Only the two files changed. Confirm every identifier used in each file is imported.
