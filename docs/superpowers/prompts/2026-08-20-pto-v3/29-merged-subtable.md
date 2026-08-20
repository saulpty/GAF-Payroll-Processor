Rework the PTO breakdown into one Monday.com-style subitem table, switch every date to US format, and take the manual stepper off floating holidays.

Files that may be created: `src/app/lib/fmtDate.ts`.
Files that may be modified: `src/app/pages/pto/PtoBreakdown.tsx`, `src/app/pages/pto/PtoRow.tsx`, `src/app/pages/pto/PtoTable.tsx`, `src/app/pages/pto/RecordApprovalDialog.tsx`.
No other file may change.

## 1. `src/app/lib/fmtDate.ts` — exact code, zero imports

```ts
// Dates in this app are YYYY-MM-DD strings (Postgres sometimes returns a full
// timestamp). Display them US-style. Never construct a Date from these.
export function fmtDate(v: string | null | undefined): string {
  if (!v) return '';
  const s = String(v).slice(0, 10);
  const p = s.split('-');
  if (p.length !== 3) return s;
  return `${p[1]}-${p[2]}-${p[0]}`;
}
```

Use `fmtDate` for **every** date shown to the user in the four files below: the Start column, the subitem dates, the eligibility tooltip, the Monday request card in the dialog. `<input type="date">` values stay `YYYY-MM-DD` — the browser formats those itself; do not touch them.

## 2. `PtoBreakdown.tsx` — one table, not three cards

Replace the three-card grid with a **single borderless table** that reads as a subitem list under the employee row, in the spirit of a Monday.com subitem block. No card, no rounded box, no shadow — just an indented table on the row's tinted background, full width, `px-6 py-3`.

Build one array of items from the loaded detail:

```ts
type Item = {
  kind: 'pending' | 'recorded';
  leave_type: 'pto' | 'floating_holiday';
  leave_on: string; return_on: string; days: number;
  status?: string; source?: string; comments?: string | null;
  id?: number;                 // recorded rows
  request?: PendingRequest;    // pending rows
};
```

- `pending` entries become `kind: 'pending'`, taking `leave_type` from the detail row.
- `ledger` entries become `kind: 'recorded'`, taking `leave_type`, `status` and `source` from the row.
- Withdrawn rows are excluded unless `showWithdrawn`.
- **Sort the whole list by `leave_on` descending** (plain string compare) so pending and recorded interleave by date. This is the only ordering.

Columns, in this order:

| Header | Content |
|---|---|
| Type | `StatusChip`: `pto` → tone `blue`, label `PTO`; `floating_holiday` → tone `violet`, label `Floating holiday` |
| Dates | `{fmtDate(leave_on)} → {fmtDate(return_on)}` |
| Days | right-aligned, `tabular-nums` |
| Status | pending → `StatusChip` tone `amber` `Pending`; recorded → tone `green` `Recorded`; withdrawn → tone `red` with `strike`, `Withdrawn` |
| Source | recorded only, 12px muted: `Monday` / `Excel` / `Manual` from the `source` value; pending shows `Monday` |
| Comments | 12px muted, truncated, full text in a `title` attribute |
| Actions | right-aligned |

Actions by row kind:
- `kind: 'pending'` → a single primary `Button size="sm"` **Record** (`Plus` icon) calling `onOpenDialog({ kind: 'record', request })`.
- `kind: 'recorded'` and `status === 'recorded'` → outline **Edit** (`Pencil`) and outline-red **Withdraw** (`Trash2`), behaving exactly as they do today.
- `kind: 'recorded'` and `status === 'withdrawn'` → no buttons.

Header row: 11px uppercase tracking-wide muted on a transparent background with a bottom border; body rows 13px divided by `border-slate-100`.

Above the table, a single 12px muted summary line, right-aligned:
`{ptoTaken} PTO days taken · {fhUsed} of {fhAllocated} floating holidays used`
where `ptoTaken` sums recorded `pto` days and `fhUsed` counts recorded `floating_holiday` rows for the year.

**Delete the floating-holiday card, the +/− stepper, the `fhUsed` local state, the rollback error caption, and the `upsertFloatingHoliday` import and mutate hook.** Floating holidays are now taken by recording them like any other leave. If `detail.fh` is still needed for the allocation number, read it; otherwise drop it.

Empty state: when the item list is empty, one `EmptyState` with `compact`, title `Nothing recorded or pending`.

## 3. `PtoRow.tsx` — FH column and dates

- Use `fmtDate` for the Start column.
- **Remove the eligibility chip from the FH-left cell.** When the employee is not yet eligible, the cell shows a muted `0` and carries `title={`Eligible ${fmtDate(fh_eligible_from)} — 90 days after hire`}`. When eligible it shows the number as it does now. The cell stays numeric so sorting still works.

## 4. `PtoTable.tsx`

Whatever it computes for `fh_left` today, change it so a not-yet-eligible employee gets `fh_left = 0` (not `null`), and keep `fh_eligible_from` populated so the row can build the tooltip.

## 5. `RecordApprovalDialog.tsx`

- Use `fmtDate` in the "Requested on Monday" card.
- Carry `leave_type` through: in **record** mode take it from `mode.request.leave_type` (default `'pto'`); in **edit** mode from `mode.row.leave_type`; in **manual** mode add a small `<select>` labelled **Type** above the dates with options `PTO` (`pto`) and `Floating holiday` (`floating_holiday`), defaulting to `pto`. Send `leave_type` on every save, to both `upsertPtoApproval` and `updatePtoApproval`.
- Add `leave_type?: 'pto' | 'floating_holiday'` to the `PendingRequest` interface and `leave_type: 'pto' | 'floating_holiday'` to `LedgerRow`.
- When the type is `floating_holiday`, the title reads `Record floating holiday` / `Edit floating holiday`.

## Constraints
- Every file under 15 KB. If `PtoBreakdown.tsx` would exceed it, split the row into `src/app/pages/pto/PtoSubRow.tsx` — that file is then also allowed.
- Dates are `YYYY-MM-DD` strings everywhere in logic and comparison; only `fmtDate` changes how they look.
- No `new Date(...)` on any date string.
- No Monday board, column or group id anywhere.
- Do not touch any action or anything under `src/components/ui/`.
