# 02 — Process Payroll: the period name fills itself in from the end date

**Only this one file may change. No other file may be touched.**

- `src/app/pages/ProcessPayroll.tsx`

Do not create files. Do not touch any action, lib, migration or other page. Do not reformat,
reorder or rename anything you are not asked to change. This is a payroll file: change only the
lines named below.

## Why

The operator (Tim) should only have to pick the dates. The period name is always
`Q1|Q2-<Mon>-<YYYY>` and follows from the end date (`periodNameFromEndDate` in
`src/app/lib/periodName.ts`, added in the previous round): a period ending on day 1–15 is Q1 of
that month, day 16 or later is Q2. Typing the name by hand is what produced the `Q1-Aug-20260`
duplicate in August.

## 1. Import

Change the existing import line

```ts
import { normalizePeriodName, isCanonical, nearMatch, nextPeriod } from '@/app/lib/periodName';
```

to

```ts
import { normalizePeriodName, isCanonical, nearMatch, nextPeriod, periodNameFromEndDate } from '@/app/lib/periodName';
```

## 2. The pre-fill effect

In the `useEffect` that pre-fills the next period, replace

```ts
    if (nx) { setPeriodName(nx.name); setStartDate(nx.startDate); setEndDate(nx.endDate); }
```

with

```ts
    if (nx) { setPeriodName(periodNameFromEndDate(nx.endDate) ?? nx.name); setStartDate(nx.startDate); setEndDate(nx.endDate); }
```

## 3. The Period Name field becomes read-only

In Step 1 (Pay Period), the Period Name `<input>` currently has
`onChange={e => setPeriodName(e.target.value)}` and `placeholder="e.g. Q3-Jun-2026"`.

- Change its label text from `Period Name *` to `Period Name (from the end date)`.
- Remove the `onChange` prop entirely and add `readOnly`.
- Change `placeholder` to `"Pick the end date"`.
- Keep the amber re-run styling; otherwise add `bg-slate-50 cursor-default`. The className
  becomes:

```tsx
className={`w-full border rounded-md px-3 py-2 text-sm cursor-default ${isRerun ? 'border-amber-400 bg-amber-50' : 'bg-slate-50'}`}
```

Keep `value={periodName}` and `disabled={isRunning}`.

## 4. The End Date field sets the name

Change the End Date input's handler from

```tsx
onChange={e => setEndDate(e.target.value)}
```

to

```tsx
onChange={e => { setEndDate(e.target.value); setPeriodName(periodNameFromEndDate(e.target.value) ?? ''); }}
```

The Start Date input does not change. The "Quick fill from" dropdown does not change — it still
sets the name and both dates of an existing period for a re-run.

## 5. Correct the re-run warning text

Under the Period Name field, the amber re-run warning currently ends with
`...resolved work will be overwritten, but rows the engine no longer generates are left in place.`
That is no longer true: the run removes them. Change that sentence to:

`This period already exists — re-run will regenerate and update entries; resolved work will be overwritten, and rows the engine no longer produces are removed (restore them from Period Log).`

## Acceptance (observable on /dev → Process Payroll)

- On load, Step 1 shows the next period pre-filled, e.g. **Q2-Sep-2026**, and the Period Name
  box cannot be typed into.
- Changing End Date to **2026-09-25** shows **Q2-Sep-2026**; to **2026-10-10** shows
  **Q1-Oct-2026**; to **2026-09-08** shows **Q1-Sep-2026** with the amber "already exists"
  warning.
- "Quick fill from" still fills the name and both dates of the chosen period.
- `src/app/pages/ProcessPayroll.tsx` is the only file changed. Nothing about how the run works,
  saves, or removes rows changes.
