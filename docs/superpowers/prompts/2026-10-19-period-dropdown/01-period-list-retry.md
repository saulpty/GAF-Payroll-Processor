# Period dropdown: retry when the period list fails to load, never show an empty list silently

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only this file may change:** `src/app/FilterBar.tsx`. **No other file may be touched.** No
migration, no action file. `src/actions/loadPeriods.ts` does not change. `PayrollMaster.tsx` does
not change.

Rules that hold for this prompt:

- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- Every file stays under 15 KB (`FilterBar.tsx` is about 13.3 KB now).
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.

## Why (Saul, 2026-10-19)

On Payroll Master the Period dropdown showed only "Choose A Period" and "All Periods", with no
periods at all. A reload fixed it.

`FilterBar.tsx` loads the period list with
`useLoadAction(loadPeriodsAction, [] as PeriodRow[])` and ignores the loading and error values.
When that one query fails (the usual connection-pressure blip during the burst of queries on a
full page load), the list stays at its empty default, nothing says so, and nothing tries again.
The only thing that re-runs it is `periodsVersion`, which changes only after processing or deleting
a period. So the dropdown stays empty until a full reload.

The fix: try again automatically, up to 3 times, 2 seconds apart. While loading or failing, the
dropdown says so.

## 1. `src/app/FilterBar.tsx` — three edits, nothing else

**1a.** Replace

```tsx
  const [periodsRaw, , , refetchPeriods] = useLoadAction(loadPeriodsAction, [] as PeriodRow[]);
```

with

```tsx
  const [periodsRaw, periodsLoading, periodsError, refetchPeriods] = useLoadAction(loadPeriodsAction, [] as PeriodRow[]);

  // A failed period load used to leave the dropdown empty until a full reload (Saul, 2026-10-19).
  // Try again up to 3 times, 2 s apart; a success resets the count.
  const periodRetries = useRef(0);
  useEffect(() => {
    if (!periodsError) {
      if (!periodsLoading) periodRetries.current = 0;
      return;
    }
    if (periodsLoading || periodRetries.current >= 3) return;
    periodRetries.current += 1;
    const t = setTimeout(() => refetchPeriods(), 2000);
    return () => clearTimeout(t);
  }, [periodsError, periodsLoading, refetchPeriods]);
```

**1b.** Replace

```tsx
              {location.pathname === '/payroll-master' && <option value="__all__">All Periods</option>}
```

with

```tsx
              {location.pathname === '/payroll-master' && <option value="__all__">All Periods</option>}
              {periods.length === 0 && (periodsLoading || periodsError) && (
                <option value="" disabled>{periodsError ? "Couldn't load periods, retrying…" : 'Loading periods…'}</option>
              )}
```

**1c.** Nothing else. `useRef` and `useEffect` are already imported. Do not change the
`versionRef` effect, the `periods` filter, `allNamedPeriods`, `periodPick`, or any other loader.

## Acceptance (check on /dev after a hard refresh)

1. Payroll → Payroll Master: the Period dropdown lists Choose A Period, All Periods, then
   Q1-Oct-2026, Q2-Sep-2026 and older, as it does today. Picking Q1-Oct-2026 loads its rows.
2. Attendance → List and Process: their period pickers are unchanged.
3. The phone Filters sheet shows the same Period list.
4. No new console errors.
5. `node --test "tests/*.test.ts"`: PL1–PL3 in `tests/periodListRetry.test.ts` now pass, and
   nothing else fails.

Note: Q2-Oct-2026 (Oct 16–31) is **not** expected in this dropdown yet. The list shows periods
that have been processed (rows in the `periods` table). It appears once that period is processed.
