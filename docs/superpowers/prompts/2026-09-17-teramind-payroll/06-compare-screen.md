# 06 — Teramind vs Payroll comparison screen (read-only)

**Paths are written as they appear in our git mirror. Inside this project the code root *is* `src`,
so `src/app/…` means `app/…` and `src/actions/…` means `actions/…`. Never create a top-level folder
named `src`.**

## Files that may change

- `src/app/lib/teramindCompare.ts` — NEW, content below **character for character**
- `src/actions/loadTeramindVsPayroll.ts` — NEW, content below **character for character**
- `src/app/pages/admin/teramind/TeramindCompare.tsx` — NEW (you write it, spec below)
- `src/app/pages/admin/teramind/TeramindTab.tsx` — smallest edit: render `<TeramindCompare />` as the
  last section of the tab

No other file may be touched. Never edit `ProcessPayroll.tsx`, `PayrollMaster.tsx`,
`ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything
under `src/components/ui/`. **This screen only reads. It must never write to `payroll_entries` or
any other table.**

## Why

Before payroll switches from an uploaded Teramind file to the Teramind API, the owner wants proof:
for every employee and every day of every past pay period, what the API says (earliest session
start, latest session finish) next to what payroll already recorded, and the difference in minutes.
All past periods are already saved in `teramind_sessions`.

## 1. `src/app/lib/teramindCompare.ts` — verbatim

```ts
// Compares what Teramind's API says (earliest session start / latest session finish per person per
// day) with what payroll already holds for that day. Pure: numbers in, verdict out. Times arrive
// as whole minutes since midnight, computed in SQL, because the database layer rewrites
// date-looking text on its way to the browser. Used only by the admin comparison screen.

export type CompareRow = {
  employee_id: number;
  name: string;
  day: string;                       // YYYY-MM-DD (callers slice to 10 first)
  period_name: string | null;        // null = payroll has no row for this day
  pay_entry: string | null;          // payroll text exactly as stored, e.g. "8:56 AM"
  pay_exit: string | null;
  pay_entry_min: number | null;
  pay_exit_min: number | null;
  tm_entry_min: number | null;
  tm_exit_min: number | null;
  tm_exit_next_day: boolean | null;  // latest finish fell on the next calendar day
  sessions: number | null;
  longest_s: number | null;          // longest single session that day, seconds
  event_type_1: string | null;
  initial_status: string | null;
  touched_after_run: boolean | null; // payroll row changed after it was first written
};

export type CompareKind =
  | 'match'          // both sides have times and they agree to the minute
  | 'close'          // differ, but by no more than `closeMinutes`
  | 'different'      // differ by more
  | 'payroll_only'   // payroll has times, Teramind has no session
  | 'teramind_only'  // Teramind has sessions, payroll has no times (or no row at all)
  | 'both_empty';    // payroll row without times and no Teramind session: they agree

export type CompareVerdict = {
  kind: CompareKind;
  entryDiff: number | null;   // Teramind minus payroll, minutes
  exitDiff: number | null;
  worst: number | null;       // largest absolute difference
  longSession: boolean;       // a session over 16 h: a machine that was never logged out
  hasPayrollRow: boolean;
};

export const LONG_SESSION_SECONDS = 16 * 3600;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Difference on a 24-hour circle, so 00:35 (next day) vs "12:35 AM" is 0, not 1440. */
export function clockDiff(a: number, b: number): number {
  return ((((a - b) % 1440) + 1440 + 720) % 1440) - 720;
}

export function classifyRow(r: CompareRow, closeMinutes = 5): CompareVerdict {
  const hasPay = isNum(r.pay_entry_min) || isNum(r.pay_exit_min);
  const hasTm = isNum(r.tm_entry_min) || isNum(r.tm_exit_min);
  const longSession = isNum(r.longest_s) && r.longest_s > LONG_SESSION_SECONDS;
  const hasPayrollRow = r.period_name !== null && r.period_name !== undefined && r.period_name !== '';
  const base = { entryDiff: null, exitDiff: null, worst: null, longSession, hasPayrollRow };

  if (!hasPay && !hasTm) return { kind: 'both_empty', ...base };
  if (hasPay && !hasTm) return { kind: 'payroll_only', ...base };
  if (!hasPay && hasTm) return { kind: 'teramind_only', ...base };

  const entryDiff = isNum(r.tm_entry_min) && isNum(r.pay_entry_min) ? clockDiff(r.tm_entry_min, r.pay_entry_min) : null;
  const exitDiff = isNum(r.tm_exit_min) && isNum(r.pay_exit_min) ? clockDiff(r.tm_exit_min, r.pay_exit_min) : null;
  const parts = [entryDiff, exitDiff].filter(isNum).map((d) => Math.abs(d));
  // One side has an entry but no exit (or the reverse): that is a difference, not a match.
  const lopsided = (entryDiff === null) !== (exitDiff === null) || parts.length === 0;
  const worst = parts.length ? Math.max(...parts) : null;
  let kind: CompareKind = 'different';
  if (!lopsided && worst === 0) kind = 'match';
  else if (!lopsided && worst !== null && worst <= closeMinutes) kind = 'close';
  return { kind, entryDiff, exitDiff, worst, longSession, hasPayrollRow };
}

export type CompareSummary = Record<CompareKind, number> & { total: number; longSessions: number; touched: number };

export function summarize(rows: CompareRow[], closeMinutes = 5): CompareSummary {
  const s: CompareSummary = {
    match: 0, close: 0, different: 0, payroll_only: 0, teramind_only: 0, both_empty: 0,
    total: 0, longSessions: 0, touched: 0,
  };
  for (const r of rows) {
    const v = classifyRow(r, closeMinutes);
    s[v.kind] += 1;
    s.total += 1;
    if (v.longSession) s.longSessions += 1;
    if (r.touched_after_run && v.kind !== 'match' && v.kind !== 'both_empty') s.touched += 1;
  }
  return s;
}

/** Whole minutes since midnight to "8:56 AM". */
export function fmtMinutes(m: number | null | undefined): string {
  if (!isNum(m)) return '—';
  const mm = ((Math.trunc(m) % 1440) + 1440) % 1440;
  const h24 = Math.floor(mm / 60);
  const min = String(mm % 60).padStart(2, '0');
  const h12 = h24 % 12 || 12;
  return `${h12}:${min} ${h24 >= 12 ? 'PM' : 'AM'}`;
}
```

## 2. `src/actions/loadTeramindVsPayroll.ts` — verbatim

```ts
import { action } from '@uibakery/data';

// One row per employee per day: Teramind's earliest session start / latest finish beside what
// payroll holds for that day. Read-only. Times are returned as whole minutes since midnight
// (integers) because date-looking text is rewritten on its way to the browser.
// `manager` is accepted (house rule: every load* takes one); filtering by manager happens in React.
function loadTeramindVsPayroll() {
  return action('loadTeramindVsPayroll', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      WITH tm AS (
        SELECT s.employee_id,
               s.work_date,
               MIN(s.started_et)  AS first_start,
               MAX(s.finished_et) AS last_finish,
               COUNT(*)::int      AS sessions,
               MAX(s.duration_s)::int AS longest_s
        FROM public.teramind_sessions s
        WHERE s.employee_id IS NOT NULL
          AND s.work_date BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
        GROUP BY s.employee_id, s.work_date
      ),
      pe AS (
        SELECT DISTINCT ON (p.employee_id, LEFT(p.work_date, 10))
               p.employee_id,
               LEFT(p.work_date, 10) AS work_date,
               p.period_name,
               NULLIF(TRIM(p.entry_time), '') AS entry_time,
               NULLIF(TRIM(p.exit_time), '')  AS exit_time,
               p.event_type_1,
               p.initial_status,
               (p.updated_at > p.created_at + interval '2 minutes') AS touched_after_run
        FROM public.payroll_entries p
        WHERE p.deleted_at IS NULL
          AND LEFT(p.work_date, 10) BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
        ORDER BY p.employee_id, LEFT(p.work_date, 10), p.period_name DESC
      )
      SELECT e.id AS employee_id,
             e.display_name AS name,
             j.work_date AS day,
             j.period_name,
             j.entry_time AS pay_entry,
             j.exit_time  AS pay_exit,
             CASE WHEN UPPER(j.entry_time) ~ '^[0-9]{1,2}:[0-9]{2} ?[AP]M$'
                  THEN (EXTRACT(EPOCH FROM to_timestamp(UPPER(j.entry_time), 'HH12:MI AM')::time) / 60)::int END AS pay_entry_min,
             CASE WHEN UPPER(j.exit_time) ~ '^[0-9]{1,2}:[0-9]{2} ?[AP]M$'
                  THEN (EXTRACT(EPOCH FROM to_timestamp(UPPER(j.exit_time), 'HH12:MI AM')::time) / 60)::int END AS pay_exit_min,
             CASE WHEN j.first_start IS NOT NULL
                  THEN SUBSTR(j.first_start, 12, 2)::int * 60 + SUBSTR(j.first_start, 15, 2)::int END AS tm_entry_min,
             CASE WHEN j.last_finish IS NOT NULL
                  THEN SUBSTR(j.last_finish, 12, 2)::int * 60 + SUBSTR(j.last_finish, 15, 2)::int END AS tm_exit_min,
             (LEFT(j.last_finish, 10) > j.work_date) AS tm_exit_next_day,
             j.sessions,
             j.longest_s,
             j.event_type_1,
             j.initial_status,
             j.touched_after_run
      FROM (
        SELECT COALESCE(tm.employee_id, pe.employee_id) AS employee_id,
               COALESCE(tm.work_date, pe.work_date)     AS work_date,
               tm.first_start, tm.last_finish, tm.sessions, tm.longest_s,
               pe.period_name, pe.entry_time, pe.exit_time, pe.event_type_1, pe.initial_status,
               pe.touched_after_run
        FROM tm
        FULL OUTER JOIN pe ON pe.employee_id = tm.employee_id AND pe.work_date = tm.work_date
      ) j
      JOIN public.employees e ON e.id = j.employee_id
      WHERE e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                     WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ORDER BY j.work_date, e.display_name;
    `,
  });
}

export default loadTeramindVsPayroll;
```

## 3. `TeramindCompare.tsx` — you write this

A card titled **Teramind vs Payroll**, same visual language as the other cards in this tab.

**Data.** A period `<select>` fed by the existing `loadPeriods` action, newest first, plus a first
option **All Periods** (earliest `start_date` → latest `end_date`). A period's range is
`String(start_date).slice(0,10)` → `String(end_date).slice(0,10)`. Default: the newest period. Load
with `useLoadAction(loadTeramindVsPayrollAction, [], { dateFrom, dateTo, viewAs })` — params **flat**,
`viewAs` from `useViewer()`. Map every row into a `CompareRow` before use:
`day: String(r.day).slice(0,10)`; each `*_min`, `sessions`, `longest_s` → `v == null ? null : Number(v)`;
booleans via `=== true`. Do **no** time arithmetic or formatting in this file — use `classifyRow`,
`summarize` and `fmtMinutes` from the lib.

**Summary tiles** (from `summarize(rows)`): Days Compared · Match · Within 5 Min · Different ·
Payroll Only · Teramind Only · No Punches Either Side · Long Sessions (>16h). Under the tiles one
sentence: `Match rate: X%` where X = match ÷ (match + close + different), one decimal; and, when
`touched > 0`, "N of the disagreeing days were changed in payroll after the run (possible hand edits)".

**Filters.** Toggle chips, one per kind, with counts. Default ON: Different, Within 5 Min, Payroll
Only, Teramind Only. Default OFF: Match, No Punches Either Side. Plus a **Long Sessions Only** chip
and a text box that filters by employee name.

**Table** (sorted by `worst` descending, nulls last, then day, then name; render at most 500 rows and
say so when more exist): Date · Employee · Period (— when the day has no payroll row) · Payroll In ·
Teramind In · Δ In · Payroll Out · Teramind Out (append " +1d" when `tm_exit_next_day`) · Δ Out ·
Sessions · Longest (h:mm from `longest_s`) · Event · Status · Edited (a small chip when
`touched_after_run`). Payroll In/Out show `pay_entry` / `pay_exit` exactly as stored; Teramind
In/Out use `fmtMinutes`. Δ columns show signed minutes (`+3`, `−20`, `0`), amber above 5, red above 30.
A long session shows a small amber "long" chip next to Longest.

**Export CSV** button: every row passing the current filters (not just the rendered 500), same
columns plus `kind`. File name `teramind-vs-payroll_<from>_<to>.csv`.

Loading, empty ("No days in this range") and error states in plain language. Title Case labels.

## Rules

- Every file under 15 KB.
- `useLoadAction(action, default, {...flatParams})` — never a `{ params: {...} }` wrapper.
- Dates are `YYYY-MM-DD` strings compared as strings; never `new Date(str)` for date math, never
  `toISOString().slice(0,10)`.
- No hardcoded ids or URLs. Read-only screen.

## Acceptance (check on /dev)

1. Admin → Employees → Teramind shows the **Teramind vs Payroll** card under the Pull Log.
2. Period Q2-Aug-2026: Elizabeth Mootoo on 2026-08-11 reads Payroll In 8:56 AM, Teramind In 8:56 AM,
   Δ 0, Payroll Out 5:01 PM, Teramind Out 5:01 PM, Δ 0, and counts as Match.
3. The tiles add up to Days Compared.
4. Export CSV downloads the filtered rows.
5. Only the four files above changed; `payroll_entries` row count is unchanged.
