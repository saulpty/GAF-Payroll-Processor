# Activity Trend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On Attendance → Activity, show for every employee whether they improved, got worse or stayed the same against the period right before the selected dates, with a before/after panel and a day-by-day chart in the opened row.

**Architecture:** The Activity data hook loads the selected range plus the same number of days before it in the same queries, then builds each period separately with the existing builders. A new pure file, `activityTrend.ts`, turns the two sets of day rows into per-employee verdicts. Four new small components render the verdict pill, the Before and After table, the chart and the day lists.

**Tech Stack:** UI Bakery (React + TypeScript + Tailwind), Postgres via UIB actions, `node --test` with native TypeScript stripping (Node 24).

**Spec:** `docs/superpowers/specs/2026-10-12-activity-trend-design.md`. Mockup: `docs/superpowers/specs/mockups/2026-10-12-activity-trend-layouts.html`, layout 2.

**Code for this plan:** `docs/superpowers/plans/2026-10-12-activity-trend/code/`. Every new or fully rewritten file is there, complete. `activityTrend.ts` and `activityTrend.test.ts` were run together in a scratch folder on 2026-10-12: 20 of 20 pass. The `.tsx` files have not been compiled; the UIB build in each task is their first compile.

## Global Constraints

- **`src/` is a read-only mirror. Never hand-edit it.** Every `src/` change goes through the change loop in `CLAUDE.md` / `docs/CHANGE-LOOP.md`: prompt file committed first → pasted into UIB → export → `node tools/sync-export.mjs "<newest zip>"` → `git status --short` shows only allowed files → tests → browser check on `/dev` after Ctrl+Shift+R → commit.
- Hand-written files only in `tests/`, `tools/`, `docs/`.
- Prompts go in `docs/superpowers/prompts/2026-10-12-activity-trend/NN-<slug>.md`. Each names exactly which files may change and says no other file may be touched. Each embeds whole files from the `code/` folder verbatim.
- Never press UIB's "Fix" button. Never touch payroll files (`ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`) or `src/components/ui/`.
- Dates are `YYYY-MM-DD` strings compared as strings. No `new Date(str)` for date maths, no `toISOString()`. Postgres timestamps are sliced to 10 characters.
- Loader parameters go flat: `useLoadAction(action, default, {...})`, never `{ params: {...} }`.
- Every file under 15 KB. Tokens, never raw hex. Title Case for headings, column headers, row labels and buttons; sentence case for tooltips and helper text; never ALL CAPS.
- Minimums (spec rule 7 and 10): 30 minutes active, 10 minutes entry, 2 days low or missed, 5 days with work. They live in `classification_config`, category `teramind`.
- Test baseline is 718. After this plan: 744 (20 in `activityTrend.test.ts`, 6 in `activityTrendWiring.test.ts`).
- Exports, pasting approved prompts, and the final merge + push are pre-authorized. **Ask Saul before Release.**

## Review Focus

1. **A new hire inside the earlier period.** Scheduled days before their start date have no work and would count as "missed", making them look Improved. Expected: those days do not count. Pinned by T8 (Task 1) and the `startDates` wiring (Task 3).
2. **The selected range's existing numbers must not move.** Loading a wider span must not change Avg Active, entry, Needs a Look or the Source of any day already shown. Expected: identical to the released app for the same dates. Pinned by TW2's per-period payroll filter (Task 1) and the side-by-side browser check in Task 3.
3. **A range with nothing before it or an odd range.** One day, a future end date, an empty date. Expected: no crash, "Not enough data", tooltip still reads sensibly. Pinned by T2, T4, T7 (Task 1) and the browser check in Task 4.
4. **An employee with no rows at all in the earlier period.** Expected: "Not enough data", opened row shows the current period's days only. Pinned by T16 (Task 1) and the browser check in Task 4.
5. **A long range.** A quarter means 180 days loaded and 60+ bars per box. Expected: the page still loads and the chart stays readable enough to see the two averages. No automated test; checked in the browser in Task 4 and reported to Saul if poor.

## File Structure

| File | Status | Job |
|---|---|---|
| `tests/activityTrend.test.ts` | new | Rules of the calculation. |
| `tests/activityTrendWiring.test.ts` | new | Source guards for the migration, hook and screens. |
| `tests/liveList.test.ts` | edit | LP5 follows the renamed column header. |
| `src/migrations/<next>_activity_trend_minimums.sql` | new (UIB) | Seeds the four minimums. |
| `src/app/lib/activityTrend.ts` | new (UIB) | Pure calculation. |
| `src/app/pages/attendance/activity/useActivityData.ts` | edit (UIB) | Loads both periods, returns trends. |
| `…/activity/TrendPill.tsx` | new (UIB) | Verdict pill and change arrow. |
| `…/activity/ActivityCompare.tsx` | new (UIB) | Before and After table. |
| `…/activity/ActivityDayChart.tsx` | new (UIB) | Two-box bar chart. |
| `…/activity/ActivityDaysSideBySide.tsx` | new (UIB) | Day lists behind the button. |
| `…/activity/ActivityByEmployee.tsx` | rewritten (UIB) | Columns and the opened row. |
| `…/activity/AttendanceActivity.tsx` | edit (UIB) | Card lines, passes trend props. |
| `…/activity/ActivityThresholds.tsx` | rewritten (UIB) | Four more fields. |
| `src/AGENTS.md` | edit (UIB) | One paragraph on the trend rules. |

`SourceBadge.tsx` stops being imported after Task 4. It stays in place; deleting it is not part of this plan.

---

### Task 1: Tests first

**Files:**
- Create: `tests/activityTrend.test.ts` (copy of `docs/superpowers/plans/2026-10-12-activity-trend/code/activityTrend.test.ts`)
- Create: `tests/activityTrendWiring.test.ts` (copy of `…/code/activityTrendWiring.test.ts`)
- Modify: `tests/liveList.test.ts` (test LP5)

**Interfaces:**
- Produces: the contract later tasks must satisfy. From `src/app/lib/activityTrend.ts`: `previousRange(dateFrom, dateTo) → { from, to, days }`, `subDays(date, n)`, `rangeLabel(from, to)`, `dayKind(day, today, startDate?) → 'worked'|'low'|'missed'|'away'|'skip'`, `summarisePeriod(days, today, startDate?) → PeriodSummary`, `compareEmployee(before|null, after, minimums?) → EmployeeTrend`, `compareTotals(before, after) → TotalsChange`, `changeText(measure, change)`, `fmtMinutes(n)`, `DEFAULT_TREND_MINIMUMS`, `VERDICT_ORDER`, `VERDICT_LABEL`.

- [ ] **Step 1: Copy the two test files**

```bash
cp docs/superpowers/plans/2026-10-12-activity-trend/code/activityTrend.test.ts tests/activityTrend.test.ts
cp docs/superpowers/plans/2026-10-12-activity-trend/code/activityTrendWiring.test.ts tests/activityTrendWiring.test.ts
```

- [ ] **Step 2: Update LP5 in `tests/liveList.test.ts`**

Replace:

```ts
test('LP5: Activity header reads "Needs a Look"', () => {
  const src = read(`${A}activity/ActivityByEmployee.tsx`);
  assert.match(src, /\{ key: 'needsLook',\s+label: 'Needs a Look' \}/);
});
```

with:

```ts
// 2026-10-12 (Saul): the By Employee column is headed with the warning sign to save width.
// The top card and the amber box still read "Needs a Look".
test('LP5: Activity By Employee heads the low-day column "⚠️ Days"; the card still reads "Needs a Look"', () => {
  const src = read(`${A}activity/ActivityByEmployee.tsx`);
  assert.match(src, /\{ key: 'needsLook',\s+label: '(Needs a Look|⚠️ Days)' \}/);
  assert.match(read(`${A}activity/AttendanceActivity.tsx`), /label="Needs a Look"/);
});
```

The header alternation keeps LP5 green both before and after Task 4; TW4 is the test that requires the new header.

- [ ] **Step 3: Run the suite and confirm what fails**

Run: `node --test "tests/*.test.ts"`
Expected: 718 pass. `tests/activityTrend.test.ts` fails as a file (`Cannot find module … activityTrend.ts`). TW1–TW6 fail. Nothing else fails.

- [ ] **Step 4: Commit**

```bash
git add tests/activityTrend.test.ts tests/activityTrendWiring.test.ts tests/liveList.test.ts
git commit -m "test: Activity trend rules and wiring guards (fail until the exports)"
```

---

### Task 2: The four minimums (prompt 01, migration)

**Files:**
- Create: `docs/superpowers/prompts/2026-10-12-activity-trend/01-trend-minimums.md`
- Create via UIB: `src/migrations/<next>_activity_trend_minimums.sql` (plus `src/migrations/applied.txt`)

**Interfaces:**
- Produces: `classification_config` rows `activity_trend_min_active_minutes` = 30, `activity_trend_min_entry_minutes` = 10, `activity_trend_min_days` = 2, `activity_trend_min_worked_days` = 5, category `teramind`.

- [ ] **Step 1: Write the prompt file** with this content:

````markdown
# Activity trend: four settings for "how much is a real change"

**Copy the SQL exactly.** Create exactly one new migration file,
`src/migrations/<next>_activity_trend_minimums.sql`, with the SQL below, and run it. **No other
file may be touched** (other than `src/migrations/applied.txt`, which records the run). Do not
edit any `.ts` / `.tsx` file.

## Why
Saul (2026-10-12): the Activity tab will compare the selected dates with the period right before
them. A number only counts as changed when it moves past a minimum. Like every other
classification setting, the minimums live in `classification_config`, never in the page.

## Migration SQL

```sql
-- Activity trend minimums (Saul, 2026-10-12). Insert-only; safe to run twice.

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES ('activity_trend_min_active_minutes', '30', 'Average Active Time Must Move By',
  'Minutes the average active time must change between the two periods before the Activity trend counts it.',
  'number', 'teramind')
ON CONFLICT (key) DO NOTHING;

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES ('activity_trend_min_entry_minutes', '10', 'Average Entry Must Move By',
  'Minutes the average entry time must change between the two periods before the Activity trend counts it.',
  'number', 'teramind')
ON CONFLICT (key) DO NOTHING;

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES ('activity_trend_min_days', '2', 'Low or Missed Days Must Move By',
  'Days the count of low-activity days, or of missed days, must change before the Activity trend counts it.',
  'number', 'teramind')
ON CONFLICT (key) DO NOTHING;

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES ('activity_trend_min_worked_days', '5', 'Days With Work Needed to Compare',
  'Fewer days with work than this in either period shows Not enough data instead of a trend.',
  'number', 'teramind')
ON CONFLICT (key) DO NOTHING;

-- ROLLBACK
-- Remove the four rows whose key starts with activity_trend_min_ by hand if this is ever undone.
```

## After running, report
The result of
`SELECT key, value FROM classification_config WHERE key LIKE 'activity_trend_min_%' ORDER BY key;`
— four rows: 30, 2, 10, 5.

## Acceptance
Nothing visible changes. The four rows exist.
````

- [ ] **Step 2: Commit the prompt**

```bash
git add docs/superpowers/prompts/2026-10-12-activity-trend/01-trend-minimums.md
git commit -m "docs: prompt 2026-10-12 activity-trend 01 (trend minimums migration)"
```

- [ ] **Step 3: Run the change loop** (paste, screenshot the textarea, submit, wait, confirm the summary is this prompt's, export, sync with the newest zip).

- [ ] **Step 4: Check the diff**

Run: `git status --short`
Expected: only `src/migrations/<n>_activity_trend_minimums.sql` and `src/migrations/applied.txt`.

- [ ] **Step 5: Run the tests**

Run: `node --test "tests/*.test.ts"`
Expected: TW1 now passes. TW2–TW6 and `activityTrend.test.ts` still fail.

- [ ] **Step 6: Verify the rows** by running the `SELECT` above against the database (Supabase connector or UIB's query runner; re-run it, do not trust a stale result). Expected: four rows, values 30, 2, 10, 5.

- [ ] **Step 7: Commit**

```bash
git add src/migrations
git commit -m "feat(activity): seed the four trend minimums (export)"
```

---

### Task 3: Calculation and data (prompt 02)

**Files:**
- Create: `docs/superpowers/prompts/2026-10-12-activity-trend/02-trend-data.md`
- Create via UIB: `src/app/lib/activityTrend.ts`
- Modify via UIB: `src/app/pages/attendance/activity/useActivityData.ts`, `src/AGENTS.md`

**Interfaces:**
- Consumes: Task 2's config rows.
- Produces: `useActivityData({ dateFrom, dateTo, compare? })`. With `compare: true` the result also carries `prev: { from, to, days }`, `today: string`, `trends: Record<number, EmployeeTrend>`, `prevDays: Record<number, ActivityDay[]>`, `startDates: Record<number, string>`, `totalsChange: TotalsChange | null`, `minimums: TrendMinimums`. Without it (the side panel), `prev.days` is 0 and the hook loads exactly what it loads today.

- [ ] **Step 1: Write the prompt file.** Header:

````markdown
# Activity trend, part 1: the calculation and the data (nothing visible yet)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only these files may change.** One new: `src/app/lib/activityTrend.ts`. Two edited:
`src/app/pages/attendance/activity/useActivityData.ts`, `src/AGENTS.md`. **No other file may be
touched.** No migration, no action file, no page file.

Dates are 'YYYY-MM-DD' strings compared as strings. Never `new Date(str)` for date maths, never
`toISOString()`. Loader parameters stay flat (no `{ params: ... }` wrapper).
````

Then section **1. New file `src/app/lib/activityTrend.ts` — the whole file**, containing `code/activityTrend.ts` verbatim in a `ts` block.

Then section **2. Edits to `useActivityData.ts`**, these eight, each as "replace … with …":

**2a.** After the line `import { buildActivityDays } from '@/app/lib/activityDays';` add:

```ts
import { previousRange, summarisePeriod, compareEmployee, compareTotals, DEFAULT_TREND_MINIMUMS } from '@/app/lib/activityTrend';
import type { EmployeeTrend, TrendMinimums, TotalsChange } from '@/app/lib/activityTrend';
```

**2b.** In `ActivityDataResult`, after `settings: ActivitySettings;` add:

```ts
  prev: { from: string; to: string; days: number };
  today: string;
  trends: Record<number, EmployeeTrend>;
  prevDays: Record<number, ActivityDay[]>;
  startDates: Record<number, string>;
  totalsChange: TotalsChange | null;
  minimums: TrendMinimums;
```

**2c.** Directly above `export function useActivityData(` add:

```ts
const TREND_KEYS: [keyof TrendMinimums, string][] = [
  ['activeMinutes', 'activity_trend_min_active_minutes'],
  ['entryMinutes', 'activity_trend_min_entry_minutes'],
  ['days', 'activity_trend_min_days'],
  ['workedDays', 'activity_trend_min_worked_days'],
];

function parseMinimums(rows: ConfigRow[]): { minimums: TrendMinimums; fallbacks: string[] } {
  const minimums: TrendMinimums = { ...DEFAULT_TREND_MINIMUMS };
  const fallbacks: string[] = [];
  for (const [field, key] of TREND_KEYS) {
    const n = Number(rows.find(r => r.category === 'teramind' && r.key === key)?.value);
    if (Number.isFinite(n) && n > 0) minimums[field] = n; else fallbacks.push(key);
  }
  return { minimums, fallbacks };
}

// Postgres can hand a date back as a full timestamp: compare the first 10 characters, as strings.
const inRange = (date: string | null | undefined, from: string, to: string): boolean => {
  const d = String(date ?? '').slice(0, 10);
  return d >= from && d <= to;
};

const NO_PREV = { from: '', to: '', days: 0 };
```

**2d.** Replace

```ts
export function useActivityData({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }): ActivityDataResult {
```

with

```ts
// compare: also load the same number of days right before the range and work out each
// employee's trend. Only the Activity page asks for it; the side panel loads its range only.
export function useActivityData({ dateFrom, dateTo, compare = false }: { dateFrom: string; dateTo: string; compare?: boolean }): ActivityDataResult {
```

**2e.** After the line `const safeTo   = dateTo   || toLocalYMD(new Date());` add:

```ts

  const prev = compare ? previousRange(safeFrom, safeTo) : NO_PREV;
  const spanFrom = prev.days > 0 ? prev.from : safeFrom;
```

**2f.** In the four loader lines for `loadTeramindActivityDaysAction`, `loadAttendanceReportDaysAction`, `loadMondayAttendanceFormsRangeAction` and `loadMondayRequestsRangeAction`, replace `dateFrom: safeFrom, dateTo: safeTo` with `dateFrom: spanFrom, dateTo: safeTo`. Change nothing else on those lines.

**2g.** In the `if (error) { … }` branch of the `useMemo`, replace `configFallbacks: [],` with:

```ts
        configFallbacks: [],
        prev, today: toLocalYMD(new Date()), trends: {}, prevDays: {}, startDates: {},
        totalsChange: null, minimums: { ...DEFAULT_TREND_MINIMUMS },
```

**2h.** Replace everything from the line `const { settings, fallbacks: configFallbacks } = parseSettings(configRows);` down to and including `return { days, byEmployee, totals, settings, configFallbacks };` with:

```ts
    const { settings, fallbacks: settingFallbacks } = parseSettings(configRows);
    const { minimums, fallbacks: minimumFallbacks } = parseMinimums(configRows);
    const configFallbacks = [...settingFallbacks, ...minimumFallbacks];

    const activityEmployees: ActivityEmployee[] = employees.map(e => ({
      id: e.id,
      name: e.name,
      role: e.role,
      manager: e.manager,
      work_days: e.work_days,
      schedule_start: e.standard_start,
      schedule_end: e.standard_end,
    }));

    const isScheduledFor = (emp: unknown, date: string) =>
      isScheduledWorkDay(
        new Date(date + 'T12:00:00'),
        (emp as { work_days?: string }).work_days,
      );

    const today = toLocalYMD(new Date());

    // One period, built the way the tab has always built its range: the attendance report over
    // that period's own payroll rows and forms, then the activity days on top of it. The loaders
    // return both periods; each build sees only its own, so the selected range is unchanged.
    const build = (from: string, to: string) => {
      const { rows: reportRows } = buildAttendanceReport({
        dateFrom: from,
        dateTo: to,
        employees,
        payrollRows: payrollRows.filter((r) => inRange(r.work_date, from, to)),
        forms: forms.filter((f) => inRange(f.form_date, from, to)),
        requests,
        holidays,
        periods,
        dstWindows,
        helpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes },
      });
      return buildActivityDays({
        dateFrom: from,
        dateTo: to,
        today,
        employees: activityEmployees,
        rows: tmRows as unknown as ActivityDayRow[],
        reportRows,
        requests,
        settings,
        isScheduledWorkDay: isScheduledFor,
      });
    };

    const { days, byEmployee, totals } = build(safeFrom, safeTo);
    const before = prev.days > 0 ? build(prev.from, prev.to) : null;

    const prevDays: Record<number, ActivityDay[]> = {};
    for (const b of before?.byEmployee ?? []) prevDays[b.employeeId] = b.days;
    const startDates: Record<number, string> = {};
    for (const e of employees) startDates[Number(e.id)] = String(e.start_date ?? '').slice(0, 10);
    const trends: Record<number, EmployeeTrend> = {};
    for (const e of byEmployee) {
      const start = startDates[e.employeeId] ?? '';
      const earlier = prevDays[e.employeeId];
      trends[e.employeeId] = compareEmployee(
        earlier ? summarisePeriod(earlier, today, start) : null,
        summarisePeriod(e.days, today, start),
        minimums,
      );
    }
    const totalsChange = before ? compareTotals(before.totals, totals) : null;

    return { days, byEmployee, totals, settings, configFallbacks, prev, today, trends, prevDays, startDates, totalsChange, minimums };
```

Note in the prompt: the existing `new Date(date + 'T12:00:00')` inside `isScheduledFor` is unchanged existing code, kept exactly.

**2i.** In the `useMemo` dependency array, add `spanFrom` after `safeTo`.

Then section **3. `src/AGENTS.md`**: in the section "Activity feature and auto-sync", append this paragraph:

```markdown
**Activity trend (added 2026-10-12).** `src/app/lib/activityTrend.ts` (pure, `import type` only)
compares the selected range with the same number of calendar days right before it.
`useActivityData({ ..., compare: true })` loads both periods in the same queries and builds each
on its own payroll rows and forms, so the selected range's numbers never depend on the earlier
one. A day counts only if it is scheduled, before today, on or after the employee's start date
and has no approved reason. Day with work → `worked` or `low` (under the existing threshold);
no work → `missed`. Minimums for "changed" are the four `activity_trend_min_*` rows in
`classification_config` (30 min active, 10 min entry, 2 days, 5 days with work). The side panel
calls the hook without `compare` and loads its own range only.
```

Then **Acceptance**: "The Activity tab looks and behaves exactly as before. Every number for the selected dates is unchanged."

- [ ] **Step 2: Commit the prompt**

```bash
git add docs/superpowers/prompts/2026-10-12-activity-trend/02-trend-data.md
git commit -m "docs: prompt 2026-10-12 activity-trend 02 (calculation + data hook)"
```

- [ ] **Step 3: Before pasting, record today's numbers.** On `/dev` → Attendance → Activity, set From 2026-09-24, To 2026-10-12. Screenshot the four cards and the By Employee table, and open Luis Abad's row and screenshot his day list. These are the "before" evidence for Review Focus 2.

- [ ] **Step 4: Run the change loop.**

- [ ] **Step 5: Check the diff**

Run: `git status --short`
Expected: only `src/app/lib/activityTrend.ts` (new), `src/app/pages/attendance/activity/useActivityData.ts`, `src/AGENTS.md`.

Run: `diff docs/superpowers/plans/2026-10-12-activity-trend/code/activityTrend.ts src/app/lib/activityTrend.ts`
Expected: no output. If UIB changed anything, re-prompt with the exact file; do not accept a paraphrase.

- [ ] **Step 6: Run the tests**

Run: `node --test "tests/*.test.ts"`
Expected: `activityTrend.test.ts` 20 pass; TW1, TW2 pass; TW3–TW6 fail; everything else passes (740 pass, 4 fail).

- [ ] **Step 7: Browser check.** Hard-refresh `/dev` (Ctrl+Shift+R). Same dates as Step 3. Compare with the Step 3 screenshots: the four cards, every By Employee row and Luis Abad's day list must be identical, including the Source column. Open the browser console: no errors. Open an employee's side panel from the List tab: it still loads. If any number differs, stop and diagnose before continuing; do not move on to Task 4.

- [ ] **Step 8: Commit**

```bash
git add src/app/lib/activityTrend.ts src/app/pages/attendance/activity/useActivityData.ts src/AGENTS.md
git commit -m "feat(activity): trend calculation and both-period data load (export); selected-range numbers verified unchanged"
```

---

### Task 4: The screens (prompt 03)

**Files:**
- Create: `docs/superpowers/prompts/2026-10-12-activity-trend/03-trend-screens.md`
- Create via UIB: `TrendPill.tsx`, `ActivityCompare.tsx`, `ActivityDayChart.tsx`, `ActivityDaysSideBySide.tsx` (all in `src/app/pages/attendance/activity/`)
- Modify via UIB: `ActivityByEmployee.tsx` (whole file replaced), `AttendanceActivity.tsx`

**Interfaces:**
- Consumes: Task 3's hook result.
- Produces: `ActivityByEmployee` props `TrendProps` = `{ trends, prevDays, startDates, beforeLabel, afterLabel, prevDayCount, today, settings }` plus the existing `byEmployee`, `expandedId`, `onToggle`.

- [ ] **Step 1: Write the prompt file.** Header:

````markdown
# Activity trend, part 2: the Trend column, the card lines and the opened row

**Copy every file and edit exactly, character for character. Do not rewrite, reformat or "improve"
anything else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only these files may change**, all in `src/app/pages/attendance/activity/`. Four new:
`TrendPill.tsx`, `ActivityCompare.tsx`, `ActivityDayChart.tsx`, `ActivityDaysSideBySide.tsx`.
One replaced whole: `ActivityByEmployee.tsx`. One edited: `AttendanceActivity.tsx`.
**No other file may be touched.** No migration, no action file, no lib file. Do not edit
`ActivityByDay.tsx`, `ActivityNeedsLook.tsx`, `AttendancePanel.tsx` or `SourceBadge.tsx`.

Design rules (src/DESIGN.md): tokens only, never a raw hex; Title Case for headings, column
headers and buttons; never ALL CAPS; numbers use `tabular-nums`.
````

Then sections 1–5, each "the whole file" with the matching file from `code/` verbatim: `TrendPill.tsx`, `ActivityCompare.tsx`, `ActivityDayChart.tsx`, `ActivityDaysSideBySide.tsx`, `ActivityByEmployee.tsx`.

Then section **6. Edits to `AttendanceActivity.tsx`**:

**6a.** After `import { toLocalYMD } from '@/app/lib/classificationEngine';` add:

```ts
import { rangeLabel, fmtMinutes } from '@/app/lib/activityTrend';
```

**6b.** Replace the whole `SummaryTile` function with:

```tsx
type TileNote = { note?: string; noteTone?: 'good' | 'bad' | '' };

// Warm look (2026-10-06): same tile as Attendance → Today — Title Case label with a dot.
// note (2026-10-12): one line comparing with the period right before the selected dates.
function SummaryTile({ label, value, accent, dot, note, noteTone }: { label: string; value: string | number; accent?: string; dot?: string } & TileNote) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex flex-col gap-0.5 min-w-[110px] shadow-card">
      <span className={`text-[22px] leading-7 font-bold tabular-nums ${accent ?? 'text-slate-900'}`}>{value}</span>
      <span className="text-[12px] text-slate-600 font-medium flex items-center gap-1.5 whitespace-nowrap">
        <span className={`w-2 h-2 rounded-full ${dot ?? 'bg-slate-300'}`} aria-hidden="true" />
        {label}
      </span>
      {note && (
        <span className={`text-[12px] mt-1 pt-1 border-t border-slate-100 whitespace-nowrap tabular-nums ${noteTone === 'good' ? 'text-status-green-ink' : noteTone === 'bad' ? 'text-status-red-ink' : 'text-slate-500'}`}>
          {note}
        </span>
      )}
    </div>
  );
}
```

**6c.** Replace

```tsx
  const { days, byEmployee, totals, settings, loading, error, configFallbacks, reloadConfig, retry } = useActivityData({
    dateFrom: safeFrom,
    dateTo: safeTo,
  });
```

with

```tsx
  const {
    days, byEmployee, totals, settings, loading, error, configFallbacks, reloadConfig, retry,
    prev, today, trends, prevDays, startDates, totalsChange,
  } = useActivityData({
    dateFrom: safeFrom,
    dateTo: safeTo,
    compare: true,
  });
```

**6d.** After `const avgActiveLabel = …;` add:

```tsx

  const beforeLabel = rangeLabel(prev.from, prev.to);
  const afterLabel = rangeLabel(safeFrom, safeTo);
  // One line under each card: these dates against the same number of days right before them.
  // The raw difference; the minimums only apply to each employee's Trend.
  const versus = (delta: number | null, lowerIsBetter: boolean, fmt: (n: number) => string): TileNote => {
    if (delta === null || prev.days === 0) return {};
    if (delta === 0) return { note: `Same as ${beforeLabel}`, noteTone: '' };
    return {
      note: `${delta > 0 ? '↑' : '↓'} ${fmt(Math.abs(delta))} vs ${beforeLabel}`,
      noteTone: (delta < 0) === lowerIsBetter ? 'good' : 'bad',
    };
  };
  const activeNote = versus(totalsChange ? totalsChange.avgActiveMin : null, false, fmtMinutes);
  const lookNote = versus(totalsChange ? totalsChange.needsLook : null, true, String);
  const lateNote = versus(totalsChange ? totalsChange.lateArrivals : null, true, String);
  const workedNote = totalsChange && prev.days > 0 ? `${totalsChange.daysWorkedBefore} in ${beforeLabel}` : undefined;
```

**6e.** Replace the four `<SummaryTile … />` lines with:

```tsx
              <SummaryTile label="Avg Active Time"  value={avgActiveLabel}    accent="text-status-green-ink" dot="bg-green-600" note={activeNote.note} noteTone={activeNote.noteTone} />
              <SummaryTile label="Days With Work"   value={totals.daysWorked} note={workedNote} />
              <SummaryTile label="Needs a Look"     value={totals.needsLook}  accent={totals.needsLook > 0 ? 'text-status-yellow-ink' : undefined} dot="bg-yellow-500" note={lookNote.note} noteTone={lookNote.noteTone} />
              <SummaryTile label="Late Arrivals"    value={totals.lateArrivals} accent={totals.lateArrivals > 0 ? 'text-status-red-ink' : undefined} dot="bg-red-600" note={lateNote.note} noteTone={lateNote.noteTone} />
```

**6f.** Replace

```tsx
              ? <ActivityByEmployee
                  byEmployee={byEmployee}
                  expandedId={expandedEmployeeId}
                  onToggle={handleToggleEmployee}
                />
```

with

```tsx
              ? <ActivityByEmployee
                  byEmployee={byEmployee}
                  expandedId={expandedEmployeeId}
                  onToggle={handleToggleEmployee}
                  trends={trends}
                  prevDays={prevDays}
                  startDates={startDates}
                  beforeLabel={beforeLabel}
                  afterLabel={afterLabel}
                  prevDayCount={prev.days}
                  today={today}
                  settings={settings}
                />
```

Then **Acceptance**: the bullet list from Step 6 below.

- [ ] **Step 2: Commit the prompt**

```bash
git add docs/superpowers/prompts/2026-10-12-activity-trend/03-trend-screens.md
git commit -m "docs: prompt 2026-10-12 activity-trend 03 (Trend column, card lines, opened row)"
```

- [ ] **Step 3: Run the change loop.** If the UIB build reports a TypeScript error, read it, fix the file in `code/` and in a follow-up prompt (`03b-…md`, committed first). Never press "Fix".

- [ ] **Step 4: Check the diff**

Run: `git status --short`
Expected: only the four new files, `ActivityByEmployee.tsx` and `AttendanceActivity.tsx`.

- [ ] **Step 5: Run the tests**

Run: `node --test "tests/*.test.ts"`
Expected: TW1–TW5 pass, TW6 fails, everything else passes (743 pass, 1 fail). LP5 and WA3 pass.

- [ ] **Step 6: Browser check** on `/dev` after Ctrl+Shift+R, From 2026-09-24, To 2026-10-12. Screenshot each:

  - The four cards each show a line ending "Sep 5 – Sep 23".
  - The table has Trend, ⚠️ Days and Days Missed columns and fits without sideways scrolling at a normal window width.
  - Hovering the ⓘ beside Trend shows both date ranges and "19 days".
  - Clicking the Trend header puts Worse first; clicking again reverses it.
  - Open Luis Abad: Before and After table and the chart appear. Check his Before figures by hand: note Avg Active, set the dates to Sep 5 – Sep 23, and compare with his row's Avg Active (today is not in that range, so they must match). Set the dates back.
  - "Show All N Days" opens two lists side by side; the label changes to "Hide the N Days".
  - Review Focus 3: set From = To = one day → every row "Not enough data", no crash. Set To to a future date → no crash.
  - Review Focus 4: find an employee with "Not enough data" (a recent hire); open the row → one explanatory line and the current period's days only.
  - Review Focus 5: pick the quarter in the Quick range → page loads; open a row; note whether the chart is still readable and report it.
  - By Day view, the amber Needs a Look box and the side panel look as they did.
  - View As a manager: the tab loads and shows only their people.
  - Console: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/attendance/activity
git commit -m "feat(activity): Trend column, card comparison lines, before/after panel and day chart (export); checked on /dev"
```

---

### Task 5: Editable minimums (prompt 04)

**Files:**
- Create: `docs/superpowers/prompts/2026-10-12-activity-trend/04-trend-thresholds.md`
- Modify via UIB: `ActivityThresholds.tsx` (whole file replaced), `AttendanceActivity.tsx`

**Interfaces:**
- Consumes: `minimums: TrendMinimums` from the hook.
- Produces: `ActivityThresholds` props `{ settings, minimums, onSaved }`.

- [ ] **Step 1: Write the prompt file.** Same "copy exactly" header. Allowed files: `ActivityThresholds.tsx` (replaced whole with `code/ActivityThresholds.tsx` verbatim) and `AttendanceActivity.tsx` with two edits:

**a.** In the `useActivityData` destructuring, replace `prev, today, trends, prevDays, startDates, totalsChange,` with `prev, today, trends, prevDays, startDates, totalsChange, minimums,`.

**b.** Replace `<ActivityThresholds settings={settings} onSaved={reloadConfig} />` with `<ActivityThresholds settings={settings} minimums={minimums} onSaved={reloadConfig} />`.

Acceptance: the Thresholds dialog shows the three existing fields, then a "Trend Minimums" heading with four fields reading 30, 10, 2, 5; saving keeps the dialog's existing behaviour.

- [ ] **Step 2: Commit the prompt**

```bash
git add docs/superpowers/prompts/2026-10-12-activity-trend/04-trend-thresholds.md
git commit -m "docs: prompt 2026-10-12 activity-trend 04 (trend minimums in the Thresholds dialog)"
```

- [ ] **Step 3: Run the change loop.**

- [ ] **Step 4: Check the diff**

Run: `git status --short`
Expected: only `ActivityThresholds.tsx` and `AttendanceActivity.tsx`.

- [ ] **Step 5: Run the tests**

Run: `node --test "tests/*.test.ts"`
Expected: 744 pass, 0 fail.

- [ ] **Step 6: Browser check** on `/dev` after Ctrl+Shift+R, as a super user: open Thresholds; the four new fields read 30, 10, 2, 5. Change "Average Active Time Must Move By" to 120 and save; the dialog closes and fewer rows show an arrow beside Avg Active. Set it back to 30 and save; re-run the `SELECT` from Task 2 and confirm 30. As a manager (View As): the Thresholds button is absent, as today.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/attendance/activity
git commit -m "feat(activity): trend minimums editable in the Thresholds dialog (export); 744/744"
```

---

### Task 6: Wrap up

**Files:**
- Create: `docs/HANDOFF-<today>.md`
- Modify: `docs/BACKLOG.md`, `CLAUDE.md` (test baseline)

- [ ] **Step 1: Write the handoff** in the style of `docs/HANDOFF-2026-10-12.md`: what is on `/dev` and not released, what was checked, and under "Watch" the Review Focus 5 result, the unused `SourceBadge.tsx`, and the two design-system gaps listed in the spec.

- [ ] **Step 2: Update `docs/BACKLOG.md`.** Add one entry "Activity trend follow-ups (2026-10-12)" listing the items the spec left out: a "since this date" shortcut on the date bar, logging conversations, a weekly trends tab, grey slots for away days in the chart, and the Activity tab's time/duration formats versus the design system.

- [ ] **Step 3: Update the baseline in `CLAUDE.md`** step 7 from 569 to 744 with today's date.

- [ ] **Step 4: Final run**

Run: `node --test "tests/*.test.ts"`
Expected: 744 pass, 0 fail.

- [ ] **Step 5: Commit, merge, push**

```bash
git add docs CLAUDE.md
git commit -m "docs: handoff + backlog for the Activity trend; test baseline 744"
```

Then, from the main checkout: `git merge --ff-only claude/employee-improvement-tracking-3cd3a0` and `git push`.

- [ ] **Step 6: Tell Saul it is on `/dev`, with the Task 4 screenshots, and ask whether to Release.** Do not release without his answer.
