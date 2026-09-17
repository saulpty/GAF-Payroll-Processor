# 09a — "Capture From Teramind" card (not wired into any page yet)

**Paths are written as they appear in our git mirror. Inside this project the code root *is* `src`,
so `src/app/…` means `app/…` and `src/actions/…` means `actions/…`. Never create a top-level folder
named `src`.**

## Files that may change

- `src/app/lib/teramindPunches.ts` — REPLACE with the content below, character for character
- `src/actions/loadTeramindPunchDays.ts` — NEW, content below, character for character
- `src/app/pages/admin/teramind/useTeramindPull.ts` — one type-only edit (section 3)
- `src/app/pages/process/TeramindSourceCard.tsx` — NEW (you write it, section 4)

No other file may be touched. **Do not edit `ProcessPayroll.tsx` in this prompt** — nothing renders
the new card yet; the next prompt wires it in. Never edit `PayrollMaster.tsx`, `ActionRequired.tsx`,
`classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything under
`src/components/ui/`.

## Why

Payroll's punches have always come from a file exported from Teramind's Time Records screen. The Hub
now saves those same records itself (`teramind_sessions`, source `time_record`) and a comparison over
all 12 past periods showed they reproduce payroll's entry/exit times to the minute. This card lets
the payroll operator take the punches for a period straight from that saved copy, after one fresh
pull. It hands the payroll page **exactly the rows the file parser would have produced**, so nothing
downstream changes.

Two things that follow from the design, so nobody "fixes" them later: (1) the SQL joins `employees`,
so every captured email is a real employee and the payroll page's "unmapped Teramind name" screen
cannot appear on this path — that is intended; (2) the SQL returns only the employees payroll
processes (active, not excluded), the same filter `loadEmployees` uses, so an employee with no
records in the period (leave, new hire) is simply absent and the page's existing "no Teramind data"
warning names them at run time.

## 1. `src/app/lib/teramindPunches.ts` — verbatim

```ts
// Turns saved Teramind sessions into the flat {email, timeStarted, timeFinished} rows the
// unchanged payroll file parser expects (sessionsToRawRows), skipping and counting anything
// with no email or a malformed clock string (sessionsToRawRowsReport). foldDays does the same
// entry/exit fold the payroll parser does, but on plain strings, for a comparison screen only
// — payroll itself never calls foldDays.

import type { TeramindSessionRow, TeramindRawRow } from './teramindTypes.ts';

const CLOCK_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export function sessionsToRawRowsReport(
  rows: TeramindSessionRow[],
): { rows: TeramindRawRow[]; skippedNoEmail: number; skippedBadClock: number } {
  const out: TeramindRawRow[] = [];
  let skippedNoEmail = 0;
  let skippedBadClock = 0;

  for (const r of rows) {
    const email = (r.teramind_email ?? '').trim().toLowerCase();
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    if (!CLOCK_RE.test(r.started_et) || !CLOCK_RE.test(r.finished_et)) {
      skippedBadClock++;
      continue;
    }
    out.push({ email, timeStarted: r.started_et, timeFinished: r.finished_et });
  }

  return { rows: out, skippedNoEmail, skippedBadClock };
}

export function sessionsToRawRows(rows: TeramindSessionRow[]): TeramindRawRow[] {
  return sessionsToRawRowsReport(rows).rows;
}

export function foldDays(rows: TeramindRawRow[]): Map<string, Map<string, { entry: string; exit: string }>> {
  const result = new Map<string, Map<string, { entry: string; exit: string }>>();

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    const day = row.timeStarted.slice(0, 10);
    if (!result.has(email)) result.set(email, new Map());
    const byDay = result.get(email)!;
    const existing = byDay.get(day);
    if (!existing) {
      byDay.set(day, { entry: row.timeStarted, exit: row.timeFinished });
    } else {
      if (row.timeStarted < existing.entry) existing.entry = row.timeStarted;
      if (row.timeFinished > existing.exit) existing.exit = row.timeFinished;
    }
  }

  return result;
}

/**
 * One employee-day as `loadTeramindPunchDays` returns it: the earliest record start and the latest
 * record finish, as plain integers (YYYYMMDD and minutes since midnight, US Eastern). Integers
 * because the database layer rewrites date-looking text on its way to the browser.
 */
export type PunchDay = {
  teramind_email: string;
  first_ymd: number;
  first_min: number;
  last_ymd: number;
  last_min: number;
};

function ymdText(n: unknown): string | null {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 19000101 || v > 29991231) return null;
  const y = Math.floor(v / 10000);
  const m = Math.floor(v / 100) % 100;
  const d = v % 100;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function minuteText(n: unknown): string | null {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 0 || v > 1439) return null;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}:00`;
}

/**
 * Saved Teramind days → the rows payroll's file parser would have produced, one per employee-day.
 * Times are cut to the whole minute on purpose: Teramind's export file only ever carried minutes,
 * and payroll's lateness maths must see exactly what it saw with the file. Cut, never rounded: the
 * 12-period comparison against payroll (98.6% of entry times exact) used this same truncation.
 */
export function punchDaysToRawRows(days: PunchDay[]): { rows: TeramindRawRow[]; skipped: number } {
  const rows: TeramindRawRow[] = [];
  let skipped = 0;
  for (const d of days) {
    const email = String(d?.teramind_email ?? '').trim().toLowerCase();
    const fd = ymdText(d?.first_ymd);
    const ft = d?.first_min == null ? null : minuteText(d.first_min);
    const ld = ymdText(d?.last_ymd);
    const lt = d?.last_min == null ? null : minuteText(d.last_min);
    if (!email || !fd || !ft || !ld || !lt || `${ld} ${lt}` < `${fd} ${ft}`) { skipped += 1; continue; }
    rows.push({ email, timeStarted: `${fd} ${ft}`, timeFinished: `${ld} ${lt}` });
  }
  return { rows, skipped };
}
```

## 2. `src/actions/loadTeramindPunchDays.ts` — verbatim

```ts
import { action } from '@uibakery/data';

// What payroll needs from the saved Teramind copy: one row per employee per day with the earliest
// record start and the latest record finish (Time Records only). Everything is returned as plain
// integers — YYYYMMDD and minutes since midnight, US Eastern — because date-looking text is
// rewritten on its way to the browser. Only employees payroll actually processes (active, not
// excluded) are returned, scoped to the signed-in viewer. Read-only.
// `manager` is accepted (house rule: every load* takes one); it is not used.
function loadTeramindPunchDays() {
  return action('loadTeramindPunchDays', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT d.employee_id,
             d.teramind_email,
             REPLACE(d.work_date, '-', '')::int                 AS day_ymd,
             REPLACE(LEFT(d.first_start, 10), '-', '')::int     AS first_ymd,
             SUBSTR(d.first_start, 12, 2)::int * 60 + SUBSTR(d.first_start, 15, 2)::int AS first_min,
             REPLACE(LEFT(d.last_finish, 10), '-', '')::int     AS last_ymd,
             SUBSTR(d.last_finish, 12, 2)::int * 60 + SUBSTR(d.last_finish, 15, 2)::int AS last_min,
             d.records,
             d.has_manual
      FROM (
        SELECT e.id                       AS employee_id,
               LOWER(e.teramind_email)    AS teramind_email,
               s.work_date,
               MIN(s.started_et)          AS first_start,
               MAX(s.finished_et)         AS last_finish,
               COUNT(*)::int              AS records,
               BOOL_OR(s.is_manual)       AS has_manual
        FROM public.teramind_sessions s
        JOIN public.employees e ON e.id = s.employee_id
        WHERE s.source = 'time_record'
          AND s.work_date BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
          AND e.active = TRUE
          AND e.excluded_from_payroll = FALSE
          AND COALESCE(e.teramind_email, '') <> ''
          AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                       WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
        GROUP BY e.id, e.teramind_email, s.work_date
      ) d
      ORDER BY d.employee_id, d.work_date;
    `,
  });
}

export default loadTeramindPunchDays;
```

## 3. `useTeramindPull.ts` — type-only edit

The `trigger` parameter of `pullRange` becomes `'manual' | 'backfill' | 'capture'`. Nothing else in
this file changes.

## 4. `src/app/pages/process/TeramindSourceCard.tsx` — you write this

```ts
import type { TeramindRawRow } from '@/app/lib/teramindTypes';

export type ApiCapture = {
  from: string; to: string;          // the period dates the capture is for (YYYY-MM-DD)
  capturedAt: string;                // display text only
  employees: number; days: number; records: number;
  fetched: number;                   // records fetched from Teramind (0 when the saved copy was used)
  fresh: boolean;                    // true = pulled from Teramind just now
};

type Props = {
  startDate: string; endDate: string; disabled: boolean;
  capture: ApiCapture | null;
  onCaptured: (rows: TeramindRawRow[], info: ApiCapture) => void;
  onCleared: () => void;
};
export function TeramindSourceCard(props: Props) { … }
```

Behaviour:

- No dates yet → one muted line: "Enter the period dates in step 1 first." No buttons.
- Primary button **Capture From Teramind**: `await pullRange(startDate, endDate, 'capture')` from
  `useTeramindPull()`, then load the days (below). While running show "Pulling from Teramind…" then
  "Reading saved copy…".
- When the saved copy already covers the dates — `coversRange` from `teramindPull.ts` over
  `loadTeramindPullLog` rows with `source === 'time_record'` and no error — also show a secondary
  button **Use Saved Copy** with the muted text "Saved copy pulled <pulled_at, local time>". It skips
  the pull and only loads the days.
- Loading the days: call `loadTeramindPunchDays` imperatively (`useMutateAction`, params **flat**):
  `{ dateFrom: startDate, dateTo: endDate, manager: '', viewAs: '' }`. **`viewAs` is deliberately the
  empty string here, not the value from `useViewer()`**: payroll must always be captured as the real
  signed-in super user, never narrowed to a manager's team by an active "View As".
  Rows = the response if it is an array, else `[]`. Map each to a `PunchDay` with `Number(...)` on
  the four numeric fields, then `punchDaysToRawRows(days)`.
- If `useViewer().isSuper` is not true, render only: "Only super users can capture payroll punches."
- **Hard stops — never call `onCaptured` when:** the pull threw; the pull reported `truncated`;
  or `rows.length === 0` ("Teramind has no records for these dates — nothing was captured."). Show
  the message in a red box in plain language. If the error says to sync the roster, add
  "Admin → Employees → Teramind".
- Success → `onCaptured(rows, info)` with `employees` = distinct emails, `days` = rows.length,
  `records` = sum of `records`, `fetched` from the pull result (0 for the saved copy).
  If `skipped > 0` show an amber line "N day(s) could not be read and were left out."
  If any day has `has_manual === true` show an amber line "N day(s) include time typed into Teramind
  by hand" with the employee emails' count — information only.
- With `capture` set, render a green box in the same style as the uploaded-file box in
  `ProcessPayroll.tsx`: **Captured From Teramind** · "{employees} employees · {days} employee-days ·
  {records} records" · "{from} → {to} · {fresh ? 'pulled just now' : 'saved copy'} · {capturedAt}" and
  an X button (disabled when `disabled`) that calls `onCleared()`.
- If `capture` is set and `capture.from !== startDate || capture.to !== endDate`, call `onCleared()`
  (in a `useEffect`) — a capture must never outlive the dates it was taken for.
- All buttons disabled when `disabled` is true or while working.

Rules: file under 12 KB · action params always flat · no time or date arithmetic in this file (the
lib does it) · dates are `YYYY-MM-DD` strings compared as strings · Title Case labels · this card
never writes to `payroll_entries`.

## Acceptance

1. Only the four files above were created or changed; `ProcessPayroll.tsx` is untouched.
2. `teramindPunches.ts` and `loadTeramindPunchDays.ts` match the content above exactly.
3. The app still builds.
