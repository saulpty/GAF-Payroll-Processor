Two bugs in the PTO breakdown. Files that may be modified: `src/app/pages/pto/PtoBreakdown.tsx`, `src/app/pages/pto/PtoTable.tsx`. No other file may change.

## Bug 1 — the detail action gets no params, so every breakdown is empty

`PtoBreakdown.tsx` currently calls:

```ts
const [rawDetail, loading, error] = useLoadAction(
  loadPtoEmployeeDetailAction,
  null,
  { params: { employee_id: row.employee_id, year, manager: null } },
);
```

The extra `params` wrapper is wrong — every other `useLoadAction` in this app passes the parameter object flat (see `PtoTable.tsx` calling `loadPtoBalancesInputs` with `{ year, manager }`). Because of the wrapper, `{{params.employee_id}}` is undefined and the query returns nothing, so Domingo Cruz (employee_id 29, 2 ledger rows, 3 pending) shows "Nothing waiting" and "No PTO recorded".

Change it to:

```ts
const [rawDetail, loading, error] = useLoadAction(
  loadPtoEmployeeDetailAction,
  null,
  { employee_id: row.employee_id, year, manager: null },
);
```

## Bug 2 — `detailKey` does nothing, so writes never refresh the breakdown

`PtoBreakdown.tsx` has:

```ts
// detailKey change forces re-mount via key in parent; we rely on re-render to reload
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _key = detailKey;
```

Nothing re-runs the load. Fix it in the parent instead: in `PtoTable.tsx`, give the breakdown a key that includes `detailKey`, so a bump remounts it and the load runs again:

```tsx
<PtoBreakdown
  key={`${row.employee_id}-${detailKey}`}
  row={row}
  ...
/>
```

Then in `PtoBreakdown.tsx` delete the `_key` line and the eslint-disable comment above it, and remove `detailKey` from the `useEffect` dependency array that syncs `fhUsed` (the remount makes it redundant). Keep `detailKey` in the props interface — the parent still passes it.

## Verify after the change
Expanding Domingo Cruz must show 3 pending Monday requests with Record buttons and 2 recorded PTO rows whose recorded days sum to 11.00, matching his Taken column.

## Constraints
- Both files stay under 15 KB.
- No `new Date(...)` on a date string; dates stay `YYYY-MM-DD` strings.
- No Monday board, column or group id anywhere.
- Do not touch any action, `RecordApprovalDialog.tsx`, the old tab files, or anything under `src/components/ui/`.
