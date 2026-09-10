# 16b — future verdict detail reads "88 days"; it should read "in 88 days"

## Files you may change

- `src/app/pages/pto/PtoVerdictCell.tsx` — the `future` detail string only

**No other file, no other line.** The detail for `state === 'future'` must be
`in ${plural(daysUntil, 'day')}` (e.g. `in 88 days`, `in 1 day`).
