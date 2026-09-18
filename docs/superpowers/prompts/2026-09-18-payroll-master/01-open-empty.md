# 01 — Payroll Master Opens Empty Until A Period Is Chosen

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

Saul's explicit request (2026-09-18): Payroll Master currently loads every
period's rows the moment the page opens. It should open **empty** with a
"Choose A Period" prompt, and the period dropdown should offer each period
plus an explicit **All Periods** option that loads everything on purpose.

## Files that may change

- `src/app/pages/PayrollMaster.tsx` — the smallest possible edit; do not
  restructure, rename or reformat anything else in this file
- `src/app/FilterBar.tsx` — only the single-period `<select>` block (the one
  under `{cfg.period && (…)}`, currently around line 143); nothing else in
  this file changes

No other file may be touched. No action changes — `loadPayrollMaster.ts` and
`countPayrollMaster.ts` already treat `periodName === ''` as "all periods";
that idiom is reused, not changed. `GlobalFilterContext.tsx` is **not**
touched — `period` already just holds a plain string, and the new sentinel
`'__all__'` needs no new field, only a new value passing through the same
string.

## Background: how `useLoadAction` already skips a call in this codebase

`HrkSummary.tsx` (line 93-98) already gates a load with a 4th options
argument:

```
const [rawData, loading, error, reload] = useLoadAction(
  loadHrkSummaryAction,
  [] as HrkRow[],
  { periodName: activePeriod },
  { enabled: activePeriod !== '' }
);
```

Use the same `{ enabled: ... }` pattern here — it is a real, already-proven
option on `useLoadAction`, not something to invent.

## Edit 1 — `PayrollMaster.tsx`: track whether a period was actually chosen

Replace:

```
  const [params, setParams] = useState({
    periodName: searchParams.get('period') || globalPeriod || '',
    employeeName: globalEmployee || '',
    status: '',
    offset: 0,
  });
```

with:

```
  const rawPeriod = searchParams.get('period') || globalPeriod || '';
  const periodChosen = rawPeriod !== '';

  const [params, setParams] = useState({
    periodName: rawPeriod === '__all__' ? '' : rawPeriod,
    employeeName: globalEmployee || '',
    status: '',
    offset: 0,
  });
```

`periodChosen` is `false` only when nothing has been picked yet (blank
default). Picking a specific period, or picking "All Periods" (`'__all__'`),
both make it `true`. `rawPeriod === '__all__'` is translated to `''` for the
actual query param, because `''` is what the SQL already reads as "no period
filter."

## Edit 2 — `PayrollMaster.tsx`: the same translation in the sync effect

Replace:

```
  useEffect(() => {
    const p = searchParams.get('period') || globalPeriod;
    setParams(prev => ({ ...prev, periodName: p || '', employeeName: globalEmployee || '', offset: 0 }));
    setPage(0);
    discardAll();
    setSavedIds(new Set());
  }, [globalPeriod, globalEmployee, searchParams]);
```

with:

```
  useEffect(() => {
    const p = searchParams.get('period') || globalPeriod || '';
    setParams(prev => ({ ...prev, periodName: p === '__all__' ? '' : p, employeeName: globalEmployee || '', offset: 0 }));
    setPage(0);
    discardAll();
    setSavedIds(new Set());
  }, [globalPeriod, globalEmployee, searchParams]);
```

## Edit 3 — `PayrollMaster.tsx`: don't run either query until a period is chosen

Replace:

```
  const [rows, loading, , reload] = useLoadAction(loadPayrollMasterAction, [] as EntryRow[], params);
  const { getEdit, update, isDirty, discard, discardAll, markSaved, dirtyCount } = useRowEdits<EntryRow, EditState>(toEditState, rows as EntryRow[]);
  const [countData] = useLoadAction(countPayrollMasterAction, [] as { total: number }[], {
    periodName: params.periodName, employeeName: params.employeeName, status: params.status,
  });
```

with:

```
  const [rows, loading, , reload] = useLoadAction(loadPayrollMasterAction, [] as EntryRow[], params, { enabled: periodChosen });
  const { getEdit, update, isDirty, discard, discardAll, markSaved, dirtyCount } = useRowEdits<EntryRow, EditState>(toEditState, rows as EntryRow[]);
  const [countData] = useLoadAction(countPayrollMasterAction, [] as { total: number }[], {
    periodName: params.periodName, employeeName: params.employeeName, status: params.status,
  }, { enabled: periodChosen });
```

## Edit 4 — `PayrollMaster.tsx`: import the existing empty-state component

`src/app/components/EmptyState.tsx` already exists and already takes
`{ icon?, title, hint?, action?, compact? }`. Add the import next to the
other `@/app/components/...` import:

Replace:

```
import { TimeInput } from '@/app/components/TimeInput';
```

with:

```
import { TimeInput } from '@/app/components/TimeInput';
import EmptyState from '@/app/components/EmptyState';
```

## Edit 5 — `PayrollMaster.tsx`: show the empty state instead of loading/querying

Replace:

```
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />Loading…
        </div>
      )}

      {!loading && (
```

with:

```
      {!periodChosen && (
        <EmptyState
          title="Choose A Period"
          hint="Pick a period above, or choose All Periods to load every period at once."
        />
      )}

      {periodChosen && loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />Loading…
        </div>
      )}

      {periodChosen && !loading && (
```

Do not add any new icon import for `EmptyState` — call it with just `title`
and `hint`, matching its existing optional props.

The closing `)}` that currently pairs with `{!loading && (` is unchanged; it
now closes the `{periodChosen && !loading && (` block instead. Nothing
inside that block changes.

## Edit 6 — `FilterBar.tsx`: add the explicit "All Periods" option, Payroll Master only

Replace:

```
      {cfg.period && (
        <>
          <label className={labelCls}>Period</label>
          <select value={period} onChange={e => setPeriod(e.target.value)} className={inputCls + ' min-w-40'}>
            <option value="">All periods</option>
            {periods.map(p => (
              <option key={p.period_name} value={p.period_name}>{p.period_name}</option>
            ))}
          </select>
          {(cfg.dateRange || cfg.employee || cfg.role || cfg.manager || cfg.statusTab || cfg.pmTab) && divider}
        </>
      )}
```

with:

```
      {cfg.period && (
        <>
          <label className={labelCls}>Period</label>
          <select value={period} onChange={e => setPeriod(e.target.value)} className={inputCls + ' min-w-40'}>
            <option value="">{location.pathname === '/payroll-master' ? 'Choose A Period' : 'All periods'}</option>
            {location.pathname === '/payroll-master' && <option value="__all__">All Periods</option>}
            {periods.map(p => (
              <option key={p.period_name} value={p.period_name}>{p.period_name}</option>
            ))}
          </select>
          {(cfg.dateRange || cfg.employee || cfg.role || cfg.manager || cfg.statusTab || cfg.pmTab) && divider}
        </>
      )}
```

## Edit 7 — `FilterBar.tsx`: never let `'__all__'` leak onto another route

`period` is **one shared context value** across `/payroll-master`, `/action-required` and
`/hrk-summary`. `ActionRequired.tsx` line 125 passes it straight through as `periodName`, and
`FilterBar` itself passes it to `loadActionRequiredCounts` (line 84). So if someone picks "All
Periods" on Payroll Master and then opens Action Required, that page queries for a period literally
named `__all__`, finds nothing, and shows an empty screen with no explanation — and the RED/YELLOW
count badges go to 0. Neither file may be edited (`ActionRequired.tsx` is protected), so clear the
sentinel in `FilterBar` instead. Add, next to the existing `versionRef` effect:

```
  useEffect(() => {
    if (period === '__all__' && location.pathname !== '/payroll-master') setPeriod('');
  }, [period, location.pathname]);
```

`setPeriod` is already destructured from `useGlobalFilters()` in this file. On `/payroll-master`
nothing changes; everywhere else `'__all__'` collapses to the blank "all periods" it already means.

`location` is already in scope in this file (`const location = useLocation();`
near the top) — no new import needed. This is the *only* select on the page
that changes; the multi-select used by `/attendance` (`cfg.periods`) and every
other filter control are untouched. `/action-required` and `/hrk-summary`
keep their current blank-option meaning of "all periods, load immediately" —
they are not `/payroll-master`, so both branches of the new ternary and the
new `<option>` leave them exactly as they render today.

## Acceptance

1. Only `PayrollMaster.tsx` and `FilterBar.tsx` changed —
   `git status --short` shows nothing else.
2. Opening `/payroll-master` fresh (no period chosen) shows the "Choose A
   Period" empty state and **no** `loadPayrollMaster` or `countPayrollMaster`
   network call fires — confirm in the browser's network tab, not just by
   reading the code.
3. Picking a specific period loads only that period's rows, as before.
4. Picking "All Periods" loads every period, with the Period column shown
   (unchanged behavior from the existing `params.periodName === ''` checks
   already in the file).
5. Deep link `/payroll-master?period=<name>` from Period Log still loads
   that period directly, skipping the empty state.
6. `/action-required` and `/hrk-summary`: the period dropdown still reads
   "All periods" as its blank option, still loads immediately with nothing
   selected — unchanged.
7. `ProcessPayroll.tsx` is untouched.
8. `node --test "tests/*.test.ts"` — L4 in `lessonGuards.test.ts` (the 14
   `cfgGet` fallback count) is unaffected; this file doesn't use `cfgGet`.
9. Save and Delete on a row still work on a chosen period.
