# Prompt 39 — FilterBar passes action params wrapped; the tab counts are dead

Sent to UIB on 2026-08-25. One coherent change: `FilterBar.tsx` only.

**Background for the reviewer, not part of the prompt.** Third occurrence of the
params-wrapper defect `LESSONS.md` records as having already bitten twice.
`FilterBar.tsx:71` passes `{ params: { periodName: period } }`; every other call
site in the app passes params flat, e.g. `HrkSummary.tsx:95`
`{ periodName: activePeriod }`.

`loadActionRequiredCounts` therefore sees `{{params.periodName}}` as NULL, so
`(NULL = '' OR period_name = NULL)` is NULL, the `WHERE` matches nothing, and
`SUM(...)` over an empty set returns NULL for both columns. `FilterBar.tsx:192`
renders the badge only `{tabCount > 0 && ...}`, so **the RED and YELLOW tab
counts on Action Required never appear at all, for any period.** Verified live:
blank under All periods, Q2-Aug-2026 and Q2-Jul-2026 alike.

Note this is *not* the source of the number on the Action Required nav badge —
that comes from `loadUnresolvedCount`, which takes no parameters and counts
every period deliberately. Only the two tab counts are affected.

---

## The prompt

`src/app/FilterBar.tsx` passes parameters to `loadActionRequiredCounts` wrapped
in an extra `params` object. UI Bakery expects them flat, so the action receives
no `periodName`, its `WHERE` clause matches nothing, and the RED and YELLOW tab
counts never render.

**Modify exactly one file:** `src/app/FilterBar.tsx`
**Do not modify any other file.** In particular do not touch
`src/actions/loadActionRequiredCounts.ts` — the SQL is correct as written.

### The change

At lines 68-72 the call currently reads:

```ts
const [countsRaw] = useLoadAction(
  loadActionRequiredCountsAction,
  [] as CountsRow[],
  { params: { periodName: period } },
);
```

Remove the `params` wrapper so the object is passed flat:

```ts
const [countsRaw] = useLoadAction(
  loadActionRequiredCountsAction,
  [] as CountsRow[],
  { periodName: period },
);
```

That is the entire change — one line. Match the shape already used at
`src/app/pages/HrkSummary.tsx:95`.

### Constraints

- Do not change the `CountsRow` type, the `counts` fallback on the next line, the
  two other `useLoadAction` calls in this file (`loadPeriods`,
  `loadAttendanceEmployees`), or anything in the render.
- Do not "improve" the fallback or add a loading state.
- Do not alter the `{tabCount > 0 && ...}` condition at line 192. Once the
  parameter arrives the counts will be real numbers and it will render on its
  own.

### Acceptance criteria — observable outcomes

1. On **Action Required** with a specific period selected, the RED and YELLOW
   tabs now show a count badge. They currently show nothing at all.
2. The two counts are **specific to the selected period** and change when the
   period changes — Q2-Aug-2026 and Q2-Jul-2026 must not show the same numbers.
3. With **All periods** selected the counts still render, covering every period
   (the action's `= ''` branch handles that case).
4. The Action Required nav badge is unchanged — it is fed by
   `loadUnresolvedCount` and is unrelated.
5. The page loads with no runtime error.
