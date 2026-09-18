# Activity feature — frozen contract (2026-09-18)

Every agent builds against this file and nothing else. Decisions here were made with Saul on
2026-09-18 and override the plan (`docs/superpowers/plans/2026-09-17-activity-monitoring-v2.md`).

## Decisions (final)

- Wording: **Title Case** for every label, chip, header and button (like the rest of the Hub:
  "On Time", "Late - Reported"). Dates display as `Wed Sep 11`. Times as `8:02 AM`.
- The live board is called **Live** (not "unofficial").
- Why chips (only these): `PTO`, `Permission` (with hours when the request has them, e.g.
  `Permission 8–12`), `Sick` (any attendance form → `Sick`; other form types → the form type in
  Title Case), `Holiday · <name>`, `WFH` (context on a worked day, never a flag), `Day Off`
  (only when the person is NOT scheduled but HAS activity), captured-period payroll labels
  translated to English (`Incapacidad`→`Sick`, `Permiso`→`Permission`, `Feriado`→`Holiday`,
  anything else → Title Case of the label), and `No Reports Yet` (amber) when nothing is found.
  **No "Time for Time" chip. No "pending" state** — a request on Monday is already approved.
- **Not scheduled and no activity → no row at all.** Not hired yet / left → no row.
- Worked on a day off or during PTO → show the reason chip AND the hours, no flag.
- Active time = Σ `duration_s` of the day's Time Records (minutes, cut not rounded).
  Breaks = (last − first) − active. Avg Active = Σ active on days worked ÷ days worked.
- Needs A Look = scheduled day, before today, no reason chip, and (no records or
  active < threshold scaled by shift length). Today is never in Needs A Look.
- Multi-account people: active is capped at (last − first); `accounts > 1` shown as a small mark.
- Thresholds live in `classification_config`, category `teramind`:
  `activity_min_active_minutes` (390), `activity_break_minutes` (60),
  `activity_break_over_minutes` (30). Never hardcoded in a page.
- Every time shown is US Eastern; "today" = `easternDate(Date.now())` from `teramindTime.ts`.
- Punches: one pair of First/Last columns. Once a period is captured the row carries
  `official: true`; if the official entry/exit differs from Teramind by ≥ 1 min, `edited: true`.

## SQL action `loadTeramindActivityDays` — output row (one per employee per calendar day)

Params: `dateFrom`, `dateTo` (YYYY-MM-DD), `viewAs`, optional `manager`. Viewer-scoped via
`v_employee_access` / `access_viewer({{ user.email }}::text, {{params.viewAs}}::text)`.
Filters `source = 'time_record'`, active employees, `excluded_from_payroll = FALSE`.
Integers only — never date-looking text (the data layer rewrites it).

```ts
export type ActivityDayRow = {
  employee_id: number;
  work_date: number;        // YYYYMMDD of the day's first record (Eastern)
  first_min: number;        // minutes since midnight Eastern of first started_et
  last_ymd: number;         // YYYYMMDD of the last finished_et (may be next day)
  last_min: number;         // minutes since midnight of last finished_et
  active_s: number;         // SUM(duration_s)
  records: number;          // COUNT(*)
  largest_gap_min: number;  // biggest gap between consecutive records, minutes (0 if one record)
  gap_start_min: number;    // minutes since midnight where that gap starts (0 if none)
  has_manual: boolean;      // any is_manual record
  accounts: number;         // COUNT(DISTINCT agent_id)
  synced_at: string;        // ISO instant (not a date-looking string — timestamptz is fine)
};
```

## Pure lib `src/app/lib/activityDays.ts` (zero runtime imports; `import type` only)

```ts
export type WhyKind = 'pto' | 'permission' | 'sick' | 'form' | 'holiday' | 'wfh' | 'day_off' | 'none';
export type WhyChip = { kind: WhyKind; label: string; tone: 'blue' | 'amber' | 'gray' };

export type ActivitySettings = {
  minActiveMinutes: number;   // 390 for a 480-min shift; scale: shiftMinutes * (390/480)
  breakMinutes: number;       // 60
  breakOverMinutes: number;   // 30
};

export type ActivityDay = {
  employeeId: number; employeeName: string; role: string; manager: string;
  date: string;               // YYYY-MM-DD
  scheduled: boolean;
  shiftMinutes: number;       // from schedule; 480 default
  firstMin: number | null; lastMin: number | null; crossesMidnight: boolean;
  activeMin: number; breaksMin: number; largestGapMin: number; gapStartMin: number;
  records: number; accounts: number; hasManual: boolean;
  official: boolean;          // payroll captured this day
  edited: boolean;            // official entry/exit differs from Teramind ≥ 1 min
  officialEntryMin: number | null; officialExitMin: number | null;
  why: WhyChip | null;        // null = worked normally; kind 'none' = "No Reports Yet"
  flag: 'low_activity' | 'long_break' | null;
  needsLook: boolean;
  isToday: boolean;
};

export type EmployeeActivitySummary = {
  employeeId: number; employeeName: string; role: string; manager: string;
  scheduledDays: number; daysWorked: number;
  avgActiveMin: number | null; avgFirstMin: number | null; avgLastMin: number | null;
  needsLook: number; awayDays: number; awayLabel: string;   // e.g. "1 · Sick"
  days: ActivityDay[];        // newest first
};

export type ActivityTotals = {
  avgActiveMin: number | null; daysWorked: number; needsLook: number; lateArrivals: number;
};

export function whyFor(args: {
  reportRow: import('./attendanceReportTypes').ReportRow | null;   // from buildAttendanceReport
  requests: import('./attendanceReportTypes').ReportRequest[];    // raw, for WFH on that day
  scheduled: boolean; hasActivity: boolean;
}): WhyChip | null;

export function buildActivityDays(input: {
  dateFrom: string; dateTo: string; today: string;
  employees: { id: number; name: string; role: string; manager: string; work_days: string; schedule_start: string; schedule_end: string }[];
  rows: ActivityDayRow[];
  reportRows: import('./attendanceReportTypes').ReportRow[];
  requests: import('./attendanceReportTypes').ReportRequest[];
  settings: ActivitySettings;
  isScheduledWorkDay: (emp: unknown, date: string) => boolean;   // from classificationEngine
}): { days: ActivityDay[]; byEmployee: EmployeeActivitySummary[]; totals: ActivityTotals };

export function fmtDayShort(ymd: string): string;   // "Wed Sep 11"
export function payrollLabelToEnglish(label: string): string;
```

## Where things go

- Slice 1 (Today why chips): `AttendanceToday.tsx` gets a Why column and an `On Leave` tile
  using `whyFor` + the four HR loaders the Reports tab already uses, for `today` only.
- Slice 2: migration (3 settings), action, lib + tests. Prompt carries lib verbatim.
- Slice 3–5: new `src/app/pages/attendance/activity/` files, each < 12 KB: `AttendanceActivity.tsx`
  (shell + KPI strip), `ActivityByEmployee.tsx` (expandable rows, headers on the expanded block),
  `ActivityByDay.tsx` (flat table + CSV), `ActivityNeedsLook.tsx`, `useActivityData.ts`.
  Attendance tabs: Today · List · Reports · Activity (· Charts, super only, later).
- FilterBar: `Periods | Dates` switch with quick picks (Today, This Week, Last 14 Days,
  This Period So Far, Last Period). Default: Periods on List/Reports, Dates on Activity/Today.
- Guards: new action in `SCOPED_ACTIONS`; no file under `pages/attendance/` imports a Teramind
  HTTP action or `useTeramindPull`; files < 15 KB; libs `import type` only.
