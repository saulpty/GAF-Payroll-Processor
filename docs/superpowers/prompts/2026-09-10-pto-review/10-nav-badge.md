# 10 — PTO Tracker nav badge with the review count, refreshed when a request is recorded

Like the Disciplinary tab's red `13`, the PTO Tracker tab shows how many
Monday requests are ready to record (prompt 07's `loadPtoReviewCount`).

## Files you may change

- `src/app/TopNav.tsx`
- `src/app/context/GlobalFilterContext.tsx`
- `src/app/pages/PtoTracker.tsx` — one call
- `src/app/pages/pto/PtoBreakdown.tsx` — one call

**No other file.** Params flat. No `toISOString()`. Every file under 15 KB.

## 1. A "PTO changed" signal — `GlobalFilterContext.tsx`

Next to `periodsVersion` / `bumpPeriodsVersion`, add `ptoVersion` /
`bumpPtoVersion` with the same shape (`useState(0)`, `v => v + 1`). Expose
both in the `GlobalFilters` type and the provider value.

**Also fix an existing bug while there:** the provider's `useMemo` dependency
list omits `periodsVersion`, so consumers can read a stale value. Add
`periodsVersion` and `ptoVersion` to that list (keep the eslint-disable
comment if it is still needed for other reasons).

## 2. Bump it after every PTO write

- `PtoTracker.tsx`: in the dialog's `onSaved` handler, after `setRefreshKey`,
  call `bumpPtoVersion()` (from `useGlobalFilters()`).
- `PtoBreakdown.tsx`: in `onChanged`'s callers (`handleWithdraw`,
  `handleRestore`) call `bumpPtoVersion()` after `onChanged()`. Simplest: get
  `bumpPtoVersion` from `useGlobalFilters()` inside `PtoBreakdown`.

## 3. The badge — `TopNav.tsx`

- The `pto` section entry gets `badge: true`.
- Load the count next to the other three:
  `const [reviewData, , , reloadReview] = useLoadAction(loadPtoReviewCountAction, [] as { count: number }[], { today: asOf, manager: null });`
  (`import loadPtoReviewCountAction from '@/actions/loadPtoReviewCount'`;
  `asOf` already exists in the component and is `toLocalYMD(new Date())`).
- `sectionBadge('pto')` returns
  `{ count, label: \`${count} PTO request${count === 1 ? '' : 's'} ready to record\` }`
  when `count > 0`, following the two existing branches.
- Refetch on change: read `ptoVersion` from `useGlobalFilters()` and add a
  ref-guarded effect exactly like `FilterBar.tsx`'s `periodsVersion` effect
  that calls `reloadReview()` when it changes.

## Verify

1. The PTO Tracker tab shows a red badge equal to the sum of the Review chips
   on `/pto` with no filters (the header "N to review" number).
2. Recording or restoring one request changes the badge without a page
   reload.
3. Other tabs' badges unchanged; no console errors; only the four files
   changed.
