Add the per-employee breakdown to the one-table PTO Tracker, and fix one display bug.

File that may be created: `src/app/pages/pto/PtoBreakdown.tsx`.
Files that may be modified: `src/app/pages/pto/PtoTable.tsx`, `src/app/pages/pto/PtoRow.tsx`.
No other file may change.

## 0. Bug fix first (PtoRow.tsx)

The Start column currently renders the raw value `2026-02-02T00:00:00.000Z`. Postgres returns `start_date::text` as a timestamp string. Display dates as the first 10 characters only — add a tiny helper in `PtoRow.tsx`:

```ts
/** Postgres sometimes hands back a full timestamp; dates in this app are YYYY-MM-DD strings. */
function ymd(v: string | null | undefined): string {
  return v ? String(v).slice(0, 10) : '';
}
```

and use it wherever a date is displayed in this file. Never construct a `Date` from these strings.

## 1. PtoTable.tsx

- Keep everything as it is, and additionally bump a `detailKey` counter whenever any write succeeds inside a breakdown, so open breakdowns refetch.
- Pass the breakdown as the row's child:

```tsx
<PtoRow key={row.employee_id} row={row} expanded={expanded.has(row.employee_id)} onToggle={() => toggle(row.employee_id)}>
  {expanded.has(row.employee_id) && (
    <PtoBreakdown
      row={row}
      year={asOf.slice(0, 4)}
      showWithdrawn={showWithdrawn}
      onOpenDialog={onOpenDialog}
      onChanged={() => { setDetailKey(k => k + 1); reload(); }}
      detailKey={detailKey}
    />
  )}
</PtoRow>
```

where `reload` re-runs `loadPtoBalancesInputs`. When `refreshKey` changes (the dialog saved), also bump `detailKey`.

## 2. PtoBreakdown.tsx

Props: `{ row: PtoRowData; year: string; showWithdrawn: boolean; onOpenDialog: (m: DialogMode) => void; onChanged: () => void; detailKey: number }`.

- `useLoadAction(loadPtoEmployeeDetailAction, null, { employee_id: row.employee_id, year, manager: null })`, re-run whenever `detailKey` changes. The action returns a single row with `pending`, `ledger` and `fh`; if the result arrives as an array take `[0]`. Guard against `pending`/`ledger` arriving as a JSON string by parsing when `typeof === 'string'`.
- While loading: a 48px-tall block with a centred `Loader2`. On error: a compact red line `Couldn't load details — loadPtoEmployeeDetail`.
- Layout: `grid grid-cols-1 lg:grid-cols-[1fr_1fr_280px] gap-4 px-6 py-4`. Each of the three blocks is a white card `rounded-lg border border-slate-200 shadow-card p-3` with an 11px uppercase muted section label.
- Dates come from Postgres and may be full timestamps — display `String(v).slice(0, 10)` everywhere. Never construct a `Date`.

### Block 1 — "Pending from Monday"
One line per entry of `pending`: `{leave_on} → {return_on}` in 13px, then `· requested {total_days} d` muted, then the reason in 12px muted, truncated with the full text in a `title` attribute. On the right a primary `Button size="sm"` labelled **Record** with a `Plus` icon calling `onOpenDialog({ kind: 'record', request })`.
Empty: `EmptyState` with `compact`, title `Nothing waiting`.

### Block 2 — "Recorded PTO"
Section label row also shows, right-aligned, `taken {sum} d` where sum is the total of `total_days` over entries with `status === 'recorded'`, to 2 decimals.
One line per entry of `ledger`, newest first, skipping `status === 'withdrawn'` unless `showWithdrawn`:
- `{leave_on} → {return_on} · {total_days} d` in 13px;
- a source `StatusChip`: `monday` → tone `violet` label `Monday`; `excel_import` → tone `slate` label `Excel`; `manual` → tone `blue` label `Manual`; anything else → tone `slate` with the raw source;
- comments in 12px muted, truncated, full text in `title`;
- actions: an outline `Button size="sm"` **Edit** with a `Pencil` icon calling `onOpenDialog({ kind: 'edit', row: entry })`; and, only when `status === 'recorded'`, an outline **Withdraw** `Button size="sm"` in red with a `Trash2` icon that first calls `window.confirm('Withdraw this PTO record? Taken will drop by ' + entry.total_days + ' days.')`, then `updatePtoApprovalStatus({ id: entry.id, status: 'withdrawn' })`, then `onChanged()`.
- withdrawn entries render with `line-through text-slate-400`, a `StatusChip` tone `red` with `strike` reading `withdrawn`, and no action buttons.
Empty: `EmptyState` with `compact`, title `No PTO recorded`.

### Block 3 — "Floating holidays {year}"
Read `detail.fh`; treat a null as `{ fh_allocated: 2, fh_used: 0 }`. Let `start = fh.pto_start_date_override || fh.start_date` (sliced to 10 chars).
- If `start` and `fhEligibleDate(start) > toLocalYMD(new Date())`: show `Eligible from {fhEligibleDate(start)}` in muted 12px, and no stepper.
- Otherwise: `{used} of {allocated} used` in 18/600, a 12px muted caption `{fhRemaining(allocated, used)} left`, and a stepper of two outline icon `Button`s (`Minus`, `Plus`), each with an `aria-label`, disabled at 0 and at `allocated` respectively. Pressing one updates local state optimistically and calls `upsertFloatingHoliday({ employee_id: row.employee_id, calendar_year: Number(year), fh_allocated: allocated, fh_used: next, notes: fh.notes ?? null })`, then `onChanged()`. On error, roll the local value back and show a 12px red caption `Couldn't save — try again`.

Import `fhEligibleDate` and `fhRemaining` from `@/app/lib/ptoAccrual` and `toLocalYMD` from `@/app/lib/classificationEngine`.

## Constraints
- Every file under 15 KB. If `PtoTable.tsx` would exceed it, move the controls strip into a new `src/app/pages/pto/PtoControls.tsx` — that file is then also allowed.
- All actions are real `<Button>` elements with an icon and a text label — no bare text links.
- Dates are strings; no `new Date(...)` on any of them.
- No Monday board, column or group id anywhere.
- Do not modify any action, `RecordApprovalDialog.tsx`, the old tab files, or anything under `src/components/ui/`.
