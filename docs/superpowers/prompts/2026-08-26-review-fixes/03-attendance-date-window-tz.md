# The Attendance date window must use local dates, not UTC

## The invariant (from `src/AGENTS.md`)

Dates in this app are `YYYY-MM-DD` **strings**, compared as strings. Panama is
**UTC−5 all year**. `new Date().toISOString().slice(0, 10)` returns the **UTC**
date, so from **19:00 Panama time onwards it returns tomorrow**. "Today" is
`toLocalYMD(new Date())` from `src/app/lib/classificationEngine.ts`, never
`toISOString()`.

Three places compute "today" or "N days ago" the forbidden way, and all three
feed the Attendance dashboard's date window. After 7pm the dashboard silently
queries a window ending tomorrow.

## Change exactly these three files

### 1. `src/app/context/GlobalFilterContext.tsx`

Line 5-6 currently read:

```ts
function fmt(d: Date) { return d.toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return fmt(d); }
```

Change `fmt` to use `toLocalYMD`, keeping the same name and signature so its
callers are unaffected:

```ts
import { toLocalYMD } from '@/app/lib/classificationEngine';

function fmt(d: Date) { return toLocalYMD(d); }
```

Leave `daysAgo` as it is — it already delegates to `fmt`, so it is fixed by this.

### 2. `src/app/pages/Attendance.tsx`

Lines 39-40 currently read:

```ts
function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
```

Replace both bodies with `toLocalYMD`, keeping both function names, signatures
and the comment above them:

```ts
function today() { return toLocalYMD(new Date()); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return toLocalYMD(d); }
```

Add `import { toLocalYMD } from '@/app/lib/classificationEngine';` — this is the
same import path `src/app/pages/PtoTracker.tsx:10` already uses.

### 3. `src/app/lib/attendanceStats.ts`

Line 245 currently reads:

```ts
const today = new Date().toISOString().slice(0, 10);
```

Change it to `const today = toLocalYMD(new Date());` and import `toLocalYMD`
from `'./classificationEngine'` — the relative path that
`src/app/lib/teramindParser.ts:2` already uses from this same directory.

## Do NOT change these — they are correct

Four other `toISOString()` uses exist. **Leave every one of them exactly as it
is.** They were each checked individually and are safe:

- `src/app/lib/attendanceStats.ts` — the `val instanceof Date` coercion, and the
  one inside `isoWeekMonday`. Both operate on a date that is already anchored,
  not on live "now".
- `src/app/pages/attendance/AttendancePanel.tsx` — the same `instanceof Date`
  coercion.
- `src/app/lib/ptoAccrual.ts` — `fromDayNumber`. Its counterpart `toDayNumber`
  builds the value with `Date.UTC(...)`, so both ends are pure UTC arithmetic
  and the local timezone never enters. Changing this one would **break** it.

## Do not touch

- No other file. No SQL, no action, no migration, no styling.
- Do not rename `fmt`, `today` or `daysAgo`, and do not change their signatures.
- Do not alter any other logic in these three files.

## Acceptance criteria

`toLocalYMD` and `toISOString().slice(0,10)` return the **same** value before
19:00 local, so nothing visible should change during the day. That is the point:
this must be a no-op right now and correct later.

- The Attendance dashboard still loads, and the 30d / 60d / 90d presets still set
  the From and To dates correctly. With the 30d preset, To is today's local date.
- Clearing the From or To date input still falls back to a sensible window
  rather than showing an error or an empty dashboard.
- The KPI figures for the 60-day window are unchanged: `DAYS TRACKED` 1428,
  `ON-TIME RATE` 63.5% (907 of 1428), `LATE — UNREPORTED` 245.
- Trends still render, and the partial-period marker still behaves.

Then confirm every identifier used in each file is imported.
