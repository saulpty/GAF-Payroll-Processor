# 08 — Action Required lists every period when "All periods" is selected

Saul's explicit request (2026-09-10) to edit `ActionRequired.tsx`. The tab badge
already counts all periods; the page refuses to show them.

## Files you may change

- `src/actions/loadActionRequired.ts`
- `src/actions/loadCommittedEntries.ts`
- `src/app/pages/ActionRequired.tsx` — the smallest possible edit; do not
  restructure, rename or reformat anything else in this 37 KB file

**No other file may be touched.**

## The two actions

Replace the bare `WHERE pe.period_name = {{params.periodName}}` with the idiom
`loadActionRequiredCounts.ts` already uses:
`WHERE (COALESCE({{params.periodName}}, '') = '' OR pe.period_name = {{params.periodName}})`.
Keep every other clause and the ORDER BY; in `loadActionRequired.ts` order by
`pe.period_name DESC` first, then the existing status/name/date order, so the
newest period is on top when all are shown. Never place `{{params.x}}` inside quotes.

## ActionRequired.tsx

1. The two `useLoadAction` calls drop `{ enabled: !!params.periodName }` — they
   always run (an empty `periodName` means all periods).
2. Delete the `{!selectedPeriod && (…"No Pay Period Selected"…)}` block.
3. Every `selectedPeriod && …` guard on the loading / all-clear / main-content /
   committed sections drops the `selectedPeriod &&` part.
4. "All clear for {selectedPeriod}!" reads "All clear — all periods!" when
   `selectedPeriod` is empty.
5. Add a **Period** column, only when `!selectedPeriod`: a header
   `<Th col="period_name" label="Period" />` right after the *Employee* header
   (add `'period_name'` to `SortKey` if the type is a literal union), and in each
   row a `<td className="px-3 py-1.5 border-r whitespace-nowrap text-slate-600">{row.period_name}</td>`
   in the same position. The committed table gets the same conditional column
   after its *Employee* header.

## Verify

- Period = *All periods* on `/action-required`: the RED tab lists rows from
  several periods with a Period column; the RED chip count equals the number of
  RED rows listed; YELLOW likewise. The Committed section lists all periods.
- Picking one period: identical to before, no Period column.
- Editing/committing a row still works on a single period.
- `grep -rn "{ params:" src/app` returns nothing. Only the three files changed.
  Confirm every identifier used is imported.
