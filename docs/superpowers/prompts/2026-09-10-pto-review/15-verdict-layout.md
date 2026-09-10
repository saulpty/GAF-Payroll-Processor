# 15 — Breakdown rows: one plain-words verdict per request, spread across columns

Saul's read of the current sub-table: the In-payroll cell is a block of text.
New layout (accepted from a mockup, with "spread it, don't stack it"):

| Type | Requested | Verdict | Payroll | (actions) |
|---|---|---|---|---|
| type chip, status chip under it | `Mon Aug 17 → Mon Aug 24` / `5 days · Monday` | icon + one short bold sentence / one grey detail line | cycle(s) in mono / one line per event with impact | Record / Edit+Withdraw / Restore |

## Files you may change

- `src/app/pages/pto/PtoBreakdown.tsx` — headers + colgroup
- `src/app/pages/pto/PtoSubRow.tsx` — cell layout
- `src/app/pages/pto/PtoPayrollCell.tsx` — becomes the **Payroll** (evidence) cell
- `src/app/pages/pto/PtoVerdictCell.tsx` — **new**, the Verdict cell

**No other file.** `ptoPayrollMatch.ts` and `fmtDay.ts` are read-only. Every
file under 15 KB. camelCase identifiers. No `toISOString()`.

## 1. `PtoBreakdown.tsx`

`HEADERS = ['Type', 'Requested', 'Verdict', 'Payroll', '']`. Colgroup:
`<col className="w-24" /><col className="w-48" /><col className="w-64" /><col /><col className="w-40" />`.
Keep `table-fixed w-full`.

## 2. `PtoSubRow.tsx` — five cells

1. **Type**: the type chip; under it (`mt-1`) the status chip (Pending /
   Recorded / Withdrawn struck) — the existing chips, just stacked.
2. **Requested**: line 1 `fmtRange(leave_on, return_on, thisYear)` in
   `text-[13px] text-slate-800 tabular-nums`; line 2
   `{days} day(s) · {Monday | Excel | Manual}` in `text-[11px] text-slate-400`.
   Withdrawn rows also show `withdrawn {fmtDay(withdrawnAt)}` as a third line.
   The invalid-date red chip stays here, under the dates. Comments stay as the
   cell `title`. Withdrawn rows keep `opacity-60` on cells 1–2.
3. **Verdict**: `<PtoVerdictCell match leaveType requestDays leaveOn thisYear />` (§4).
4. **Payroll**: `<PtoPayrollCell match thisYear />` (§3).
5. **Actions**: unchanged (Record + reason line, Edit/Withdraw, Restore).

## 3. `PtoPayrollCell.tsx` — evidence only

Props shrink to `{ match, thisYear }`. Renders, and nothing else:

- cycles in `font-mono text-[11px] text-slate-500` (comma-joined), when any;
- one line per `byType` entry: `{label} ×{count}` + `<span className="text-slate-400"> · {impact}</span>` when impact is non-empty, in `text-[12px] text-slate-600`;
- for `future`, `invalid`, `not_processed`, `before_history`, `no_rows`: a
  single `—` in `text-slate-300`.

No icons, no verdict words here any more. The wrapper `title` keeps the full
event list joined with `; `.

## 4. `PtoVerdictCell.tsx` — new

```ts
import type { PayrollMatch } from '@/app/lib/ptoPayrollMatch';
import { fmtDay } from '@/app/lib/fmtDay';
interface Props { match: PayrollMatch; leaveType: 'pto' | 'floating_holiday'; requestDays: number; leaveOn: string; thisYear: string }
```

Renders an icon (lucide, `w-4 h-4 shrink-0 mt-0.5`) beside two lines: a
**sentence** in `text-[13px] font-medium` and a **detail** in
`text-[11px] text-slate-400`. Tone = colour of icon + sentence.

| state | tone / icon | sentence | detail |
|---|---|---|---|
| `matched`, no mismatch | emerald `CircleCheck` | `Matches` | `{actualDays} day(s), back {fmtDay(actualReturn)}` — FH: `1 floating holiday, back …` |
| `matched`, mismatch, `actualReturn` set | amber `AlertTriangle` | `Was out {actualDays} day(s), not {requestDays}` — when `firstOff !== leaveOn` prefix `Started {fmtDay(firstOff)} · ` | `back {fmtDay(actualReturn)}` |
| `matched`, `actualReturn === null`, `firstOff` set | amber `AlertTriangle` | `Return not in payroll` | `off from {fmtDay(firstOff)}` |
| `matched`, `firstOff === null` | amber `AlertTriangle` | FH: `Payroll has this as {first byType label}` · PTO: `No PTO day in payroll` | FH: `not a floating holiday` · PTO: `` |
| `partial` | slate `Hourglass` | `Still out when payroll stopped` | `processed through {fmtDay(dataThrough)}` |
| `not_processed` | slate `Hourglass` | `Payroll hasn't run for these days yet` | `processed through {fmtDay(dataThrough)}` (omit when null) |
| `before_history` | slate `History` | `Before payroll history` | `payroll starts {fmtDay(historyFrom)}` |
| `future` | slate `Clock` | `Hasn't happened yet` | `starts {fmtDay(leaveOn)}` |
| `no_rows` | slate `Minus` | `No payroll rows for these days` | `` |
| `worked` | amber `AlertTriangle` | `Worked these days` | `` |
| `invalid` | red `AlertCircle` | `Return is before leave` | `fix the Monday request` |

Tone classes: emerald `text-emerald-700`, amber `text-amber-700`, red
`text-red-700`, slate `text-slate-600` (detail always `text-slate-400`).

## Verify (on /dev)

Ulla Hees expanded, 1520px wide: four rows read left-to-right as *type ·
requested · verdict · payroll · button* with no cell wrapping into a block;
`Aug 17 → Aug 24` says **Was out 7 days, not 5** / *back Mon Aug 24* and the
Payroll cell reads `Q2-Aug-2026` / `PTO ×5 · Paid`; the Jul 28 FH says
**Payroll has this as Permiso Remunerado** / *not a floating holiday*; the
Aug 31 row says **Payroll hasn't run for these days yet** with `—` in
Payroll. Arelis Acosta's withdrawn row is dimmed with `withdrawn Wed Sep 9`
under the dates. No console errors; all four files < 15 KB.
