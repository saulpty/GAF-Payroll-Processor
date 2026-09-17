# 12 — Attendance → Today: who is working right now, and when they came in

**Paths are written as they appear in our git mirror. Inside this project the code root *is* `src`,
so `src/app/…` means `app/…` and `src/actions/…` means `actions/…`. Never create a top-level folder
named `src`.**

## Files that may change

- `src/app/lib/teramindToday.ts` — NEW, content below, character for character
- `src/app/lib/teramindTime.ts` — REPLACE with the content below, character for character (one function added)
- `src/actions/loadTeramindDayPunches.ts` — NEW, content below, character for character
- `src/app/pages/attendance/AttendanceToday.tsx` — NEW (you write it, section 2)
- `src/app/pages/Attendance.tsx`, `src/app/TopNav.tsx`, `src/app/FilterBar.tsx` — the three small edits in section 3, nothing else

No other file may be touched. Never edit `ProcessPayroll.tsx`, `PayrollMaster.tsx`,
`ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything
under `src/components/ui/`. This page only reads.

## Why

Managers of remote staff want to see, today, who is in, when they started and whether they were
late — not two weeks later when the pay period is processed. The Hub now keeps a live copy of
Teramind's time records (`teramind_sessions`, refreshed about every 15 minutes while a super user has
the Hub open). This tab shows that copy for one day. It is an **unofficial live view**: the official
attendance record is still what payroll captures. Every viewer sees only their own people — the
loader is scoped exactly like the other Attendance loaders.

## 1. Verbatim files

### `src/app/lib/teramindToday.ts`

```ts
// Builds the live "Today" board for managers: who is working, when they started, late or not.
// Pure combinator over already-loaded employee/punch rows plus injected schedule helpers (the
// same three attendanceReport.ts uses). No imports, no system clock; "now"/"today" come in as args.

export type TodayEmployee = {
  id: number; name: string; email: string; role: string; manager: string;
  work_days: string; start_date: string | null;
  standard_start: string; standard_end: string; dst_start: string; dst_end: string; grace_minutes: number;
};
export type TodayPunch = {
  employee_id: number; first_min: number | null; last_ymd: number | null; last_min: number | null;
  records: number; active_s: number; has_manual: boolean;
};
export type TodayHelpers = {
  isScheduledWorkDay: (date: Date, workDays: string | undefined) => boolean;
  getSchedule: (
    emp: { dst_start: string; dst_end: string; standard_start: string; standard_end: string; grace_minutes: number },
    date: Date,
    dstWindows: { year: number; us_dst_start: string; us_dst_end: string }[],
  ) => { start: string; end: string; grace: string };
  parseTimeToMinutes: (t: string) => number;
};
export type TodayStatus =
  | 'working' | 'away' | 'not_in_yet' | 'late_not_in' | 'finished' | 'day_off' | 'holiday' | 'not_started';
export type TodayRow = {
  employeeId: number; name: string; role: string; manager: string;
  status: TodayStatus; scheduled: boolean; holidayName: string | null;
  scheduledStartMin: number | null; scheduledEndMin: number | null; graceUntilMin: number | null;
  entryMin: number | null; minutesLate: number; lateAfterGrace: boolean;
  lastActivityMin: number | null; lastActivityNextDay: boolean; idleMinutes: number | null;
  activeMinutes: number; records: number; hasManual: boolean;
};
export type TodaySummary = {
  total: number; scheduled: number; working: number; away: number; notInYet: number; lateNotIn: number;
  finished: number; dayOff: number; holiday: number; lateArrivals: number;
};
export type TodayInput = {
  day: string; nowMin: number; isToday: boolean; awayAfterMinutes?: number;
  employees: TodayEmployee[]; punches: TodayPunch[]; holidays: { date: string; name: string }[];
  dstWindows: { year: number; us_dst_start: string; us_dst_end: string }[]; helpers: TodayHelpers;
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toIntOr(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
// YYYY-MM-DD -> Date at noon (DST-safe), matching attendanceReport.ts's ymdToDate.
function ymdToDate(s: string): Date {
  return new Date(s + 'T12:00:00');
}
function ymdStringToInt(s: string): number {
  const n = Number(s.slice(0, 10).replace(/-/g, ''));
  return Number.isFinite(n) ? n : 0;
}
// Merge possibly-duplicate punch rows for one employee into a single summary.
function mergePunches(rows: TodayPunch[]): TodayPunch {
  let firstMin: number | null = null;
  let lastYmd: number | null = null;
  let lastMin: number | null = null;
  let records = 0;
  let activeS = 0;
  let hasManual = false;
  for (const r of rows) {
    const fm = toNum(r.first_min);
    if (fm !== null && (firstMin === null || fm < firstMin)) firstMin = fm;
    const ly = toNum(r.last_ymd);
    const lm = toNum(r.last_min);
    if (ly !== null && lm !== null) {
      if (lastYmd === null || ly > lastYmd || (ly === lastYmd && (lastMin === null || lm > lastMin))) {
        lastYmd = ly;
        lastMin = lm;
      }
    } else if (lm !== null && lastYmd === null) {
      if (lastMin === null || lm > lastMin) lastMin = lm;
    }
    records += toIntOr(r.records, 0);
    activeS += toIntOr(r.active_s, 0);
    hasManual = hasManual || r.has_manual === true;
  }
  return { employee_id: rows[0]!.employee_id, first_min: firstMin, last_ymd: lastYmd, last_min: lastMin, records, active_s: activeS, has_manual: hasManual };
}
const STATUS_ORDER: TodayStatus[] = [
  'late_not_in', 'not_in_yet', 'away', 'working', 'finished', 'holiday', 'day_off', 'not_started',
];
export function buildToday(input: TodayInput): { rows: TodayRow[]; summary: TodaySummary } {
  const { day, nowMin, isToday, helpers, dstWindows, holidays } = input;
  const awayAfterMinutes = input.awayAfterMinutes ?? 20;
  const { isScheduledWorkDay, getSchedule, parseTimeToMinutes } = helpers;
  const punchesByEmp = new Map<number, TodayPunch[]>();
  for (const p of input.punches) {
    const list = punchesByEmp.get(p.employee_id);
    if (list) list.push(p); else punchesByEmp.set(p.employee_id, [p]);
  }
  const holiday = holidays.find((h) => h.date.slice(0, 10) === day) ?? null;
  const dayYmd = ymdStringToInt(day), dateObj = ymdToDate(day);
  const rows: TodayRow[] = [];
  for (const emp of input.employees) {
    const merged = punchesByEmp.has(emp.id) ? mergePunches(punchesByEmp.get(emp.id)!) : null;
    const entryMin = merged ? merged.first_min : null;
    const lastActivityMin = merged ? merged.last_min : null;
    const lastActivityNextDay = !!(merged && merged.last_ymd !== null && merged.last_ymd > dayYmd);
    const activeMinutes = merged ? Math.floor(merged.active_s / 60) : 0;
    const records = merged ? merged.records : 0, hasManual = merged ? merged.has_manual : false;
    const base = {
      employeeId: emp.id, name: emp.name, role: emp.role, manager: emp.manager,
      entryMin, lastActivityMin, lastActivityNextDay, activeMinutes, records, hasManual,
    };
    // not started yet
    if (emp.start_date && emp.start_date.slice(0, 10) > day) {
      rows.push({
        ...base, entryMin: null, lastActivityMin: null, lastActivityNextDay: false, activeMinutes: 0, records: 0, hasManual: false,
        status: 'not_started', scheduled: false, holidayName: null,
        scheduledStartMin: null, scheduledEndMin: null, graceUntilMin: null,
        minutesLate: 0, lateAfterGrace: false, idleMinutes: null,
      });
      continue;
    }
    const sched = getSchedule(emp, dateObj, dstWindows);
    const scheduledStartMin = parseTimeToMinutes(sched.start), scheduledEndMin = parseTimeToMinutes(sched.end);
    const parsedGrace = parseTimeToMinutes(sched.grace);
    const graceUntilMin = parsedGrace > 0 ? parsedGrace : scheduledStartMin + emp.grace_minutes;
    const minutesLate = entryMin !== null ? Math.max(0, entryMin - scheduledStartMin) : 0;
    const lateAfterGrace = entryMin !== null && entryMin > graceUntilMin;
    const idleMinutes = lastActivityMin !== null && !lastActivityNextDay ? Math.max(0, nowMin - lastActivityMin) : null;
    const schedFields = { scheduledStartMin, scheduledEndMin, graceUntilMin, minutesLate, lateAfterGrace, idleMinutes };
    if (holiday) {
      rows.push({ ...base, ...schedFields, status: 'holiday', scheduled: false, holidayName: holiday.name });
      continue;
    }
    if (!isScheduledWorkDay(dateObj, emp.work_days)) {
      rows.push({ ...base, ...schedFields, status: 'day_off', scheduled: false, holidayName: null });
      continue;
    }
    let status: TodayStatus;
    if (entryMin === null) {
      status = isToday && nowMin <= graceUntilMin ? 'not_in_yet' : 'late_not_in';
    } else if (!isToday) {
      status = 'finished';
    } else if (lastActivityNextDay || (lastActivityMin !== null && nowMin - lastActivityMin <= awayAfterMinutes)) {
      status = 'working';
    } else if (nowMin >= scheduledEndMin) {
      status = 'finished';
    } else {
      status = 'away';
    }
    rows.push({ ...base, ...schedFields, status, scheduled: true, holidayName: null });
  }
  rows.sort((a, b) => {
    const oa = STATUS_ORDER.indexOf(a.status);
    const ob = STATUS_ORDER.indexOf(b.status);
    if (oa !== ob) return oa - ob;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  const count = (f: (r: TodayRow) => boolean) => rows.filter(f).length;
  const summary: TodaySummary = {
    total: rows.length,
    scheduled: count((r) => r.scheduled),
    working: count((r) => r.status === 'working'),
    away: count((r) => r.status === 'away'),
    notInYet: count((r) => r.status === 'not_in_yet'),
    lateNotIn: count((r) => r.status === 'late_not_in'),
    finished: count((r) => r.status === 'finished'),
    dayOff: count((r) => r.status === 'day_off'),
    holiday: count((r) => r.status === 'holiday'),
    lateArrivals: count((r) => r.lateAfterGrace),
  };
  return { rows, summary };
}
export function fmtClock(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return '—';
  const total = ((Math.round(min) % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60), m = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m < 10 ? '0' + m : m} ${h24 < 12 ? 'AM' : 'PM'}`;
}
export function fmtDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '—';
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60), m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
```

### `src/app/lib/teramindTime.ts`

```ts
// The only place in this app where a timezone conversion happens. Teramind's API
// returns login-session start timestamps in a format we have not confirmed yet, so
// this lib parses every plausible shape (ISO with Z/offset, epoch seconds/ms, or a
// naive "already Eastern" clock string) and turns it into US-Eastern wall-clock text
// `YYYY-MM-DD HH:MM:SS`. A wrong hour changes what people are paid, so correctness
// around DST matters more than anything else here.

const EPOCH_S_RE = /^\d{10}$/;
const EPOCH_MS_RE = /^\d{13}$/;
const INSTANT_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/i;
const NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?$/;

export function parseInstant(raw: string | number): number | null {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) return null;
    const digits = Math.abs(raw).toString();
    if (EPOCH_S_RE.test(digits)) return raw * 1000;
    if (EPOCH_MS_RE.test(digits)) return raw;
    return null;
  }
  if (typeof raw !== 'string') return null;
  if (EPOCH_S_RE.test(raw)) return Number(raw) * 1000;
  if (EPOCH_MS_RE.test(raw)) return Number(raw);
  const m = INSTANT_RE.exec(raw);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, frac, offsetRaw] = m;
  const ms = frac ? Number((frac + '000').slice(0, 3)) : 0;
  let offsetMinutes = 0;
  if (offsetRaw.toUpperCase() !== 'Z') {
    const sign = offsetRaw[0] === '-' ? -1 : 1;
    const digitsOnly = offsetRaw.slice(1).replace(':', '');
    const oh = Number(digitsOnly.slice(0, 2));
    const om = Number(digitsOnly.slice(2, 4));
    offsetMinutes = sign * (oh * 60 + om);
  }
  const base = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), s ? Number(s) : 0, ms);
  return base - offsetMinutes * 60000;
}

export function isNaiveClock(raw: string): boolean {
  return typeof raw === 'string' && NAIVE_RE.test(raw);
}

function normalizeNaiveClock(raw: string): string {
  const m = NAIVE_RE.exec(raw) as RegExpExecArray;
  const [, y, mo, d, h, mi, s] = m;
  return `${y}-${mo}-${d} ${h}:${mi}:${s ?? '00'}`;
}

let cachedFormatter: Intl.DateTimeFormat | null = null;
function getFormatter(): Intl.DateTimeFormat {
  if (!cachedFormatter) {
    cachedFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  return cachedFormatter;
}

export function easternClock(ms: number): string {
  const parts = getFormatter().formatToParts(new Date(ms));
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  const hour = map.hour === '24' ? '00' : map.hour; // guard the hourCycle 'h23' midnight quirk
  return `${map.year}-${map.month}-${map.day} ${hour}:${map.minute}:${map.second}`;
}

export function easternDate(ms: number): string {
  return easternClock(ms).slice(0, 10);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function addSecondsToClock(clock: string, seconds: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(clock) as RegExpExecArray;
  const [, y, mo, d, h, mi, s] = m;
  const base = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  const next = new Date(base + seconds * 1000);
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())} ${pad2(next.getUTCHours())}:${pad2(next.getUTCMinutes())}:${pad2(next.getUTCSeconds())}`;
}

export function addDays(ymd: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd) as RegExpExecArray;
  const [, y, mo, d] = m;
  const base = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  const next = new Date(base + n * 86400000);
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

export function hasTimezone(s: string): boolean {
  return /Z$/i.test(s) || /[T ]\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:?\d{2})/.test(s);
}

export function sessionClock(
  raw: string | number,
  durationS: number,
): { work_date: string; started_et: string; finished_et: string; started_raw: string } | null {
  const dur = Number.isFinite(durationS) && durationS > 0 ? Math.trunc(durationS) : 0;
  const ms = parseInstant(raw);
  if (ms !== null) {
    const started_et = easternClock(ms);
    const finished_et = easternClock(ms + dur * 1000);
    return { work_date: started_et.slice(0, 10), started_et, finished_et, started_raw: String(raw) };
  }
  if (typeof raw === 'string' && isNaiveClock(raw)) {
    const started_et = normalizeNaiveClock(raw);
    const finished_et = addSecondsToClock(started_et, dur);
    return { work_date: started_et.slice(0, 10), started_et, finished_et, started_raw: String(raw) };
  }
  return null;
}

/** Minutes since midnight, US Eastern, for an instant — "what time is it for the punches right now". */
export function easternMinutes(ms: number): number {
  const clock = easternClock(ms);
  return Number(clock.slice(11, 13)) * 60 + Number(clock.slice(14, 16));
}
```

### `src/actions/loadTeramindDayPunches.ts`

```ts
import { action } from '@uibakery/data';

// One row per employee for ONE day from the saved Teramind copy (Time Records only): first record
// start, last record finish, how many records, seconds of tracked time, and when that employee's
// rows were last refreshed. Times are whole minutes since midnight, US Eastern, as integers —
// date-looking text is rewritten on its way to the browser. Scoped to the signed-in viewer.
// `manager` is accepted (house rule: every load* takes one); manager filtering happens in React.
function loadTeramindDayPunches() {
  return action('loadTeramindDayPunches', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT d.employee_id,
             SUBSTR(d.first_start, 12, 2)::int * 60 + SUBSTR(d.first_start, 15, 2)::int AS first_min,
             REPLACE(LEFT(d.last_finish, 10), '-', '')::int                              AS last_ymd,
             SUBSTR(d.last_finish, 12, 2)::int * 60 + SUBSTR(d.last_finish, 15, 2)::int  AS last_min,
             d.records,
             d.active_s,
             d.has_manual,
             d.synced_at
      FROM (
        SELECT s.employee_id,
               MIN(s.started_et)        AS first_start,
               MAX(s.finished_et)       AS last_finish,
               COUNT(*)::int            AS records,
               SUM(s.duration_s)::int   AS active_s,
               BOOL_OR(s.is_manual)     AS has_manual,
               MAX(s.synced_at)         AS synced_at
        FROM public.teramind_sessions s
        JOIN public.employees e ON e.id = s.employee_id
        WHERE s.source = 'time_record'
          AND s.work_date = {{params.day}}::text
          AND e.active = TRUE
          AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                       WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
        GROUP BY s.employee_id
      ) d
      ORDER BY d.employee_id;
    `,
  });
}

export default loadTeramindDayPunches;
```

## 2. `src/app/pages/attendance/AttendanceToday.tsx` — you write this

Default export `AttendanceToday`. Same page frame as `AttendanceReport.tsx` (flex column, scrolling
body, same paddings and the Attendance green `#2AA876` for accents).

**Day.** `const today = easternDate(Date.now())` (from `@/app/lib/teramindTime`). State `day`,
default `today`. A date input (`type="date"`, max = today) plus a **Today** button. `isToday = day === today`.

**Data** (all params flat):
- `useLoadAction(loadAttendanceEmployees, [], { viewAs })`
- `useLoadAction(loadTeramindDayPunches, [], { day, manager: '', viewAs })` — keep its 4th tuple
  element (refetch)
- `useLoadAction(loadHolidays, [])`, `useLoadAction(loadDstCalendar, [])`
- `viewAs` from `useViewer()`; `employee`, `role`, `manager` from `useGlobalFilters()`; filter the
  employees exactly as `Attendance.tsx` does (`matchesManager`, role equality, name/email contains).
- Employees map straight into `TodayEmployee` (`id, name, email, role, manager, work_days, start_date,
  standard_start, standard_end, dst_start, dst_end, grace_minutes` — `Number(...)` on id and
  grace_minutes, `start_date || null`). Punch rows pass through as `TodayPunch`.
- `buildToday({ day, nowMin, isToday, employees, punches, holidays, dstWindows, helpers:
  { isScheduledWorkDay, getSchedule, parseTimeToMinutes } })` with the helpers imported from
  `@/app/lib/classificationEngine` (import only — never edit that file).
- `nowMin = easternMinutes(Date.now())`, held in state and updated by a 60-second `setInterval` that
  also calls the punches refetch — **only while `isToday`**. Clear the timer on unmount.
- "Data As Of": the newest `synced_at` among the punch rows, shown with
  `new Date(v).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })`; "—" when there are none.
  `synced_at` is a real instant, so this is the only place `new Date(value)` is allowed here.
- No other date or time arithmetic in this file. Use `fmtClock` and `fmtDuration` from the lib.

**Header line.** "Live View — Unofficial. Data As Of {time}. Records refresh about every 15 minutes
while a super user has the Hub open. Times are US Eastern."

**Summary tiles** from `summary`: Working · Away · Not In Yet · Late – Not In · Finished · Day Off /
Holiday (dayOff + holiday) · Late Arrivals. For a past day hide Working / Away / Not In Yet.

**Table** (rows already sorted by the lib; reuse the table look of `AttendanceReportTable.tsx`):
Employee (name, role muted under it) · Status chip · Scheduled (`fmtClock(scheduledStartMin)` –
`fmtClock(scheduledEndMin)`, "—" when not scheduled) · Entry · Late (`+N min`, red when
`lateAfterGrace`, muted "on time" when 0 and there is an entry) · Last Activity (append " +1d" when
`lastActivityNextDay`) · Idle (`fmtDuration(idleMinutes)`, only when `isToday` and status is working
or away) · Active Time (`fmtDuration(activeMinutes)`) · Records (small chip **manual** when `hasManual`).
Status chips: Working green · Away amber · Not In Yet slate · Late – Not In red · Finished blue ·
Day Off / Holiday (holiday shows the holiday name) / Not Started muted.
For holiday / day-off rows that still have records, show the times normally.

Loading, error and empty ("No employees match these filters") states in plain language. Title Case
labels. File under 13 KB — split a `TodayTable` sub-component into its own file in the same folder
only if you must.

## 3. Wiring — three small edits

- `Attendance.tsx`: `type Tab = 'list' | 'reports' | 'today'`; in `tabFromPath` add
  `if (pathname.includes('/today')) return 'today';` as the first line; in `Attendance()` add
  `if (tab === 'today') return <AttendanceToday />;` next to the reports line; import it. Nothing else.
- `TopNav.tsx`: in the attendance section's links add, **first**,
  `{ to: '/attendance/today', label: 'Today', icon: Clock }` (import `Clock` from `lucide-react` if it
  is not already imported). Do not change the section's `home` or `paths`.
- `FilterBar.tsx`: add one `ROUTE_CONFIG` entry
  `'/attendance/today': { employee: true, role: true, manager: true },` — no `periods`.

`/attendance/*` is already one route, so `app.tsx` needs no change — do not touch it.

## Rules

Every file under 15 KB · `useLoadAction(action, default, {...flatParams})`, never a `{ params: {} }`
wrapper · dates are `YYYY-MM-DD` strings compared as strings; never `toISOString().slice(0,10)`;
the Eastern "today" comes from `easternDate` only · no `Intl`, no timezone maths outside
`teramindTime.ts` · this page never calls Teramind and never writes anything.

## Acceptance (check on /dev)

1. Attendance shows **Today · List · Reports**; Today opens at `/attendance/today`.
2. The three verbatim files match the content above exactly; only the seven files listed changed.
3. As a super user: every active employee is listed with a status; people with records show Entry,
   Last Activity and Active Time; "Data As Of" shows a time.
4. With "View As" a manager: only that manager's people are listed.
5. Picking yesterday shows Finished / Late – Not In statuses and hides the live tiles.
