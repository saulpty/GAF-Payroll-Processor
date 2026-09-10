# 16 — Breakdown rows: polish (buttons next to the evidence, one chip, plain-words source, real plurals, Status column at the end)

Presentation only. Nothing computed changes; `ptoPayrollMatch.ts`, actions
and tests are untouched.

## Files you may change

- `src/app/pages/pto/PtoBreakdown.tsx`
- `src/app/pages/pto/PtoSubRow.tsx`
- `src/app/pages/pto/PtoVerdictCell.tsx`
- `src/app/pages/pto/PtoPayrollCell.tsx`

**No other file.** Every file under 15 KB. camelCase identifiers. No
`toISOString()`.

## 1. Columns — `PtoBreakdown.tsx`

`HEADERS = ['Type', 'Requested', 'What payroll says', 'Evidence', '', 'Status']`.
Colgroup: `w-28 · w-48 · w-60 · (no class, auto) · w-44 · w-28`.
The table stops stretching: `className="table-fixed border-collapse text-left w-auto min-w-[960px]"`
(drop `w-full`), so the buttons sit right after the evidence instead of at
the page edge.

## 2. Cells — `PtoSubRow.tsx` (six cells, in this order)

1. **Type**: plain text, no chip: `PTO` / `Floating holiday`, in
   `text-[12px] text-slate-600 whitespace-nowrap`.
2. **Requested**: line 1 `fmtRange(...)` as today; line 2 in
   `text-[11px] text-slate-400`: `{n} {n === 1 ? 'day' : 'days'}` followed by
   ` · from Monday board` for pending rows, ` · from Excel` for
   `source === 'excel_import'`, ` · added manually` for `manual`, and
   **nothing** for a recorded Monday row (it is the default). The invalid-date
   red chip stays under the dates. Comments stay in the cell `title`.
3. **What payroll says**: `<PtoVerdictCell …/>` unchanged props.
4. **Evidence**: `<PtoPayrollCell …/>`.
5. **Actions**: as today, except (a) Withdraw becomes quiet —
   `variant="ghost" size="sm" className="text-slate-500 hover:text-red-600 hover:bg-red-50"`
   with the `Trash2` icon; Edit stays outline — and (b) the reason line under
   a disabled Record renders **only** for `not_processed` (`after payroll runs`)
   and `invalid` (`dates don't make sense`). For `future` there is no line
   (the verdict already says *in N days*).
6. **Status**: the existing status chip (Pending amber / Recorded green /
   Withdrawn red struck). Withdrawn rows keep `withdrawn {fmtDay(withdrawnAt)}`
   under the chip in `text-[11px] text-slate-400`. Withdrawn rows keep
   `opacity-60` on cells 1–2 only.

## 3. Sentences — `PtoVerdictCell.tsx`

Add `function plural(n: number, w: string) { return `${n} ${w}${n === 1 ? '' : 's'}`; }`
and use it everywhere a count is printed (`7 days`, `1 day`).

Sentence / detail table becomes (icons and tones unchanged):

| state | sentence | detail |
|---|---|---|
| `matched`, no mismatch | `Matches` | PTO: `{plural(actualDays,'day')}, back {fmtDay(actualReturn)}` · FH: `1 floating holiday, back …` |
| `matched`, mismatch, return known | `Was out {plural(actualDays,'day')}, not {requestDays}` (prefix `Started {fmtDay(firstOff)} · ` when `firstOff !== leaveOn`) | `back {fmtDay(actualReturn)}` |
| `matched`, return unknown | `Return not in payroll` | `off from {fmtDay(firstOff)}` |
| `matched`, `firstOff === null` | FH: `Payroll has this as {first byType label}` · PTO: `No PTO day in payroll` | FH: `not a floating holiday` |
| `partial` | `Not in payroll yet` | `processed through {fmtDay(dataThrough)}` |
| `not_processed` | `Payroll not run yet` | `processed through {fmtDay(dataThrough)}` (omit when null) |
| `before_history` | `Before payroll history` | `payroll starts {fmtDay(historyFrom)}` |
| `future` | `Hasn't happened yet` | `in {plural(daysUntil,'day')}` — compute with `defaultTotalDays(today, leaveOn)`; add `today: string` to the props and pass it from `PtoSubRow` |
| `no_rows` | `No payroll rows` | `` |
| `worked` | `Worked these days` | `` |
| `invalid` | `Return is before leave` | `fix the Monday request` |

**"Matches" must not hide a second event.** On any `matched` row, when
`byType` contains entries whose `label` is not the leave's own type (`PTO`
for pto; for FH, entries whose `impact` is not `Floating Holiday / B-Day Off`),
render a third line in `text-[11px] text-amber-700`:
`also {label} · {impact}` for each such entry (count in parentheses when > 1),
e.g. `also Permiso Remunerado · Incapacidad`. Ignore `Feriado` (holidays are
expected inside a PTO span).

## 4. `PtoPayrollCell.tsx`

The `—` placeholder gets `block text-center`. Nothing else.

## Verify (on /dev, ~1450px wide)

Domingo Cruz expanded: buttons within ~40px of the evidence, not at the page
edge; Dec 7 row reads `Mon Dec 7 → Fri Dec 11 / 4 days · from Monday board` ·
`Hasn't happened yet / in 92 days` · `—` · greyed Record with no line under it
· `Pending` chip in the last column. `Floating holiday` on one line, no chip.
His FH Mar 13 row shows `Matches / 1 floating holiday, back Tue Mar 17` plus
`also Permiso Remunerado · Incapacidad`. Ulla Hees Aug 31: `Payroll not run
yet / processed through Mon Aug 24`, `after payroll runs` under the button.
A recorded row: Edit outline, Withdraw quiet (red on hover). No console
errors; 245 tests; only the four files changed.
