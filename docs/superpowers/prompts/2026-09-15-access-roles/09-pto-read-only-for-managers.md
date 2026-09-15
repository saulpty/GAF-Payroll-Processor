# 09 — PTO Tracker is read-only for managers

## Files that may change

- `src/app/pages/PtoTracker.tsx`
- `src/app/pages/pto/PtoSubRow.tsx`

No other file may be touched. Do not remove any code path; only hide controls.
Do not touch `RecordApprovalDialog.tsx`.

## Why

Saul decided managers may look at PTO but not record it for now. Super users
keep every button. A manager must not see **Add manually**, **Record**,
**Edit**, **Withdraw** or **Restore**.

`useViewer()` from `@/app/context/ViewerContext` exposes `isSuper`.

## 1. `src/app/pages/PtoTracker.tsx`

- Add `import { useViewer } from '@/app/context/ViewerContext';` and
  `const { isSuper } = useViewer();` at the top of the component.
- Render the **Add manually** `<Button>` only when `isSuper`. The Download
  button stays for everyone.
- Render `<RecordApprovalDialog … />` only when `isSuper`.

## 2. `src/app/pages/pto/PtoSubRow.tsx`

- Add the same import and `const { isSuper } = useViewer();`.
- In the actions `<td>` (the one containing Restore / Record / Edit / Withdraw),
  wrap its **entire contents** in `{isSuper && ( <> … </> )}`. The `<td>` itself
  stays so columns keep lining up.

## Acceptance

1. Lint clean.
2. Then confirm every identifier used in both files is imported, in particular
   `useViewer`.

Do not build anything else.
