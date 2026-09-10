# 08 — PTO page: Review column, coverage-gated Record, impact lines, invalid-date alert, wider cells, refresh in place

Prompts 06 and 07 landed `recordability()`, `payrollCovers`, `invalidDates`,
`byType[].impact` (in `src/app/lib/ptoPayrollMatch.ts`) and `review_count` /
`waiting_count` (in `loadPtoBalancesInputs`). This prompt wires them into the
page. **Do not modify `ptoPayrollMatch.ts`, `fmtDay.ts`, `ptoAccrual.ts` or
any action.**

## Files you may change

- `src/app/pages/PtoTracker.tsx`
- `src/app/pages/pto/PtoTable.tsx`
- `src/app/pages/pto/PtoRow.tsx`
- `src/app/pages/pto/PtoBreakdown.tsx`
- `src/app/pages/pto/PtoSubRow.tsx`
- `src/app/pages/pto/PtoPayrollCell.tsx`

**No other file.** Not the dialog (next prompt). Every file stays under 15 KB.
camelCase identifiers (H4 guard). `useLoadAction` params flat. No
`toISOString()`.

---

## 1. Review replaces Pending — `PtoTable.tsx`, `PtoRow.tsx`, `PtoTracker.tsx`

- `RawRow`: drop `pending_count`; keep `review_count`, `waiting_count`.
  `PtoRowData`: replace `pending: number` with `review: number` and
  `waiting: number` (`Number(r.review_count) || 0`, same for waiting).
- Column: `{ key: 'review', label: 'Review', align: 'center', tip: 'Requests you can record now — the return date has passed and payroll for those days is processed. "N not yet" are future or not yet in payroll.' }`.
- `PtoRow` cell: `review > 0` → amber `StatusChip` with the number; else a
  muted dash. When `waiting > 0`, append
  `<span className="ml-1 text-[11px] text-slate-400 whitespace-nowrap">{waiting} not yet</span>`.
- Checkbox label `Only with pending` → `Only with review`; it filters on
  `review + waiting > 0` (so a person with only waiting requests still shows).
- Sorting by the column sorts on `review`.
- `PtoTracker`: header text `N employees · N to review` using the sum of
  `review`; `onCountsChange` payload key renamed `review`. The XLSX export
  column header `Pending` → `Review`, value `r.review`.

## 2. Record gating and reasons — `PtoSubRow.tsx`

Replace the current `returnPassed` / `daysUntilReturn` logic with:

```ts
import { recordability } from '@/app/lib/ptoPayrollMatch';
const rec = recordability(item.match, item.return_on, today, defaultTotalDays);
```

Pending rows: the Record button is `disabled={!rec.ok}`. Under it, one muted
line (`text-[11px] text-slate-400 mt-0.5`):

| `rec.reason` | text | `title` |
|---|---|---|
| `future` | `in {daysUntil} day(s)` | `Record after the return date has passed` |
| `not_processed` | `after payroll runs` | `Payroll for these dates has not been processed yet` |
| `invalid` | `dates don't make sense` | `Return date is before the leave date — fix the Monday request` |

When `rec.ok` nothing renders under the button.

## 3. Invalid-date alert — `PtoSubRow.tsx`

In the Dates cell, when `item.match.invalidDates`, render under the range:

```tsx
<div className="mt-1"><StatusChip tone="red" icon={<AlertCircle className="w-3 h-3" />}>Return is before leave — fix on Monday</StatusChip></div>
```

(`AlertCircle` from lucide-react; `StatusChip` already accepts `icon`.) This
must be visible in the row, not a tooltip.

## 4. Source folds into Status, wider cells — `PtoBreakdown.tsx`, `PtoSubRow.tsx`

- `HEADERS = ['Type', 'Dates', 'Days', 'Status', 'In payroll', '']` — the
  Source column is removed. In the Status cell, under the chip, render the
  source as `<div className="text-[11px] text-slate-400">{item.kind === 'pending' ? 'Monday' : sourceLabel(item.source)}</div>`
  (keep `sourceLabel`; for withdrawn rows the existing "withdrawn {date}" line
  stays and the source line goes above it).
- Add a `<colgroup>` right after `<table …>` in `PtoBreakdown.tsx`:
  `<col className="w-24" /><col className="w-52" /><col className="w-12" /><col className="w-32" /><col /><col className="w-44" />`
  and give the table `table-fixed`. The In-payroll `<td>` drops
  `max-w-[260px]` and gets `min-w-[320px]`. Dates cell keeps
  `whitespace-nowrap` but the alert chip below it may wrap.

## 5. Impact per event — `PtoPayrollCell.tsx`

`CyclesByType` renders `byType` as **one line per entry**:

```tsx
{byType.map((b, i) => (
  <div key={i} className="text-slate-600">
    {b.label} ×{b.count}
    {b.impact && <span className="text-slate-400"> · {b.impact}</span>}
  </div>
))}
```

The wrapper `title` becomes the same lines joined with `; `. When
`match.state === 'invalid'` the cell renders nothing (return `null`).

## 6. Refresh in place — `PtoTable.tsx`, `PtoBreakdown.tsx`

Today every save unmounts the table (spinner) and remounts every breakdown
(`key` includes `detailKey`), so the expanded employee and the scroll
position are lost. Change:

- `PtoTable.tsx`: show the full-height spinner **only** when
  `loading && (rawRows as RawRow[]).length === 0`. Otherwise keep the
  `DataTable` mounted and, while `loading`, show a small
  `<Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />` at the end
  of the controls strip.
- `PtoBreakdown` key becomes just `row.employee_id`; pass `detailKey` as a prop
  named `refreshToken`.
- `PtoBreakdown.tsx`: keep the existing `reload` from `useLoadAction`. Add a
  ref-guarded effect (same shape as the `refreshRef` effect in `PtoTable`):
  when `refreshToken` changes, call `reload()`. Change the loading branch so
  the empty-state spinner shows **only** when `loading && !detail`; when data
  is already present and `loading` is true, render the table as usual with a
  small spinner in the header row's last `<th>`.
- Nothing else about `onChanged` / `refreshKey` changes.

---

## Verify (I will do this on /dev)

1. Header reads `N employees · N to review`; Arelis Acosta shows a dash and
   `1 not yet`; Ulla Hees shows an amber `2` and `2 not yet` (or whatever the
   data says — the chip must equal `review_count`).
2. Expand Arelis Acosta: the Source column is gone, the FH May 11 row's cell
   reads `Q2-May-2026` / `Permiso Remunerado ×1 · Floating Holiday / B-Day Off`
   / `Ausencia Justificada. ×1 · Incapacidad` / `Back Wed May 13 · 1 day ✓`,
   each on its own line, nothing truncated at 1520px wide.
3. Ulla Hees `Aug 31 → Sep 7`: Record disabled, `after payroll runs`.
4. Jennette Torrano `Feb 16 → Feb 11`: red chip in the Dates cell, Record
   disabled, `dates don't make sense`, In-payroll cell empty.
5. Withdraw then Restore a recorded row on an expanded employee: the employee
   stays expanded, the table does not jump, the row flips status in place.
6. No console errors; `grep -rn "{ params:" src/app` empty; all files < 15 KB.
