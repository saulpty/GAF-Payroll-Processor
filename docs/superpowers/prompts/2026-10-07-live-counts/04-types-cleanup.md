# Count unprocessed days, step 4 of 4: remove the leftover live fields from the types

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

Saul (2026-10-07): days payroll hasn't processed must **count in every total exactly as payroll
would count them** (late / on time from Teramind; Monday form / PTO / holiday as usual; a past
workday with no punches and nothing on file = absent; today counts only once someone has punched
in), and the **Live pills and notes go** — they were confusing. When payroll processes a day, its
row replaces the Teramind stand-in automatically.

Nothing visible changes. `attendanceStats.ts` counts every row (no live exclusion, no
liveDays / liveLate) and `attendanceReportTypes.ts` has no `LiveInfo` / `live`.

**Only these two files may change** (whole files below): `src/app/lib/attendanceStats.ts`,
`src/app/lib/attendanceReportTypes.ts`. No other file may be touched.

## `src/app/lib/attendanceStats.ts` (whole file)

```ts
export const EXCUSED_STATUSES  = ['Excused (PTO/FH/Perm)'];
export const PERMISSION_STATUSES = ['Permission'];
export const ABSENT_STATUSES   = ['Absent - Unexplained'];

export type AttendanceRow = {
  email: string;
  name: string;
  date: string;
  entry_time: string | null;
  exit_time?: string | null;
  status: string;
  bucket: string | null;
  filed_gaf: boolean;
  minutes_late: number;
  period_name: string;
  time_off_kind: string | null;
};

export type EmpInfo = {
  email: string;
  name: string;
  role: string;
  manager: string;
  schedule_name: string;
  standard_start: string;
  standard_end: string;
};

export function isExcluded(status: string) {
  return EXCUSED_STATUSES.includes(status) || PERMISSION_STATUSES.includes(status);
}

export function isAbsent(status: string) {
  return ABSENT_STATUSES.includes(status);
}

export type EmpStats = {
  email: string;
  name: string;
  role: string;
  manager: string;
  schedule: string;
  days: number;
  onTime: number;
  totalLate: number;
  reported: number;
  unreported: number;
  excused: number;
  permission: number;
  absent: number;
  daysWorked: number;
  avgMinLate: number;
  pctOnTime: number;
  b1to10: number;
  b11to30: number;
  b31plus: number;
  /** GAF form reporting: filed = days with filed_gaf=true, needed = late+absent days */
  filing: { filed: number; needed: number };
  rows: AttendanceRow[];
};

export function computeEmployeeStats(
  rows: AttendanceRow[],
  empMap: Map<string, EmpInfo>,
  emails: Set<string>
): EmpStats[] {
  const byEmp = new Map<string, AttendanceRow[]>();
  emails.forEach(em => byEmp.set(em, []));
  rows.forEach(r => {
    if (emails.has(r.email)) byEmp.get(r.email)!.push(r);
  });

  return Array.from(byEmp.entries()).map(([email, empRows]) => {
    const info = empMap.get(email);
    // active = rows that count toward on-time rate (excused & permission excluded)
    const active  = empRows.filter(r => !isExcluded(r.status));
    // arrived = active rows that are NOT an unexplained absence (have real arrival)
    const arrived = active.filter(r => !isAbsent(r.status));
    const absent  = active.filter(r => isAbsent(r.status)).length;
    const onTime       = arrived.filter(r => r.status === 'On Time').length;
    const reported     = arrived.filter(r => r.status === 'Late - Reported').length;
    const unreported   = arrived.filter(r => r.status === 'Late - Unreported').length;
    const excused      = empRows.filter(r => r.status === 'Excused (PTO/FH/Perm)').length;
    const permission   = empRows.filter(r => r.status === 'Permission').length;
    const sumMin       = arrived.reduce((s, r) => s + r.minutes_late, 0);
    const daysWorked   = arrived.length;
    const avgMinLate   = daysWorked > 0 ? sumMin / daysWorked : 0;
    const days         = active.length;   // includes absent rows → "expected"
    const pctOnTime    = days > 0 ? (onTime / days) * 100 : 0;
    const b1to10  = arrived.filter(r => r.bucket === 'late_1to10').length;
    const b11to30 = arrived.filter(r => r.bucket === 'late_11to30').length;
    const b31plus = arrived.filter(r => r.bucket === 'late_830plus').length;
    // Reporting: needed = late + absent days; filed = those with filed_gaf=true
    const needReporting = [...arrived.filter(r => r.status !== 'On Time'), ...active.filter(r => isAbsent(r.status))];
    const filedCount  = needReporting.filter(r => r.filed_gaf).length;
    const neededCount = needReporting.length;
    return {
      email,
      name: info?.name ?? email,
      role: info?.role ?? '',
      manager: info?.manager ?? '',
      schedule: info ? `${info.standard_start} – ${info.standard_end}` : '—',
      days, onTime, totalLate: reported + unreported,
      reported, unreported, excused, permission, absent, daysWorked,
      avgMinLate, pctOnTime, b1to10, b11to30, b31plus,
      filing: { filed: filedCount, needed: neededCount },
      rows: empRows,
    };
  });
}

export type CompanyKpis = {
  daysTracked: number;     // expected days = on time + late + absent (rate denominator)
  onTime: number;
  lateReported: number;
  lateUnreported: number;
  lateDays: number;        // lateReported + lateUnreported
  excused: number;         // "Time off"
  permission: number;
  absent: number;
  reported: number;        // late or absent days with a form
  unreported: number;      // late or absent days without a form
  totalRows: number;
  workDays: number;        // every scheduled shift day, incl. time off and permission
  avgMinLate: number;      // over late days only
  onTimeRate: number;
  lateRate: number;
};

export function computeCompanyKpis(rows: AttendanceRow[]): CompanyKpis {
  const active  = rows.filter(r => !isExcluded(r.status));
  const arrived = active.filter(r => !isAbsent(r.status));
  const onTime        = arrived.filter(r => r.status === 'On Time').length;
  const lateReported  = arrived.filter(r => r.status === 'Late - Reported').length;
  const lateUnreported = arrived.filter(r => r.status === 'Late - Unreported').length;
  const excused       = rows.filter(r => r.status === 'Excused (PTO/FH/Perm)').length;
  const permission    = rows.filter(r => r.status === 'Permission').length;
  const absent        = active.filter(r => isAbsent(r.status)).length;
  const lateRows      = arrived.filter(r => r.status === 'Late - Reported' || r.status === 'Late - Unreported');
  const sumLate       = lateRows.reduce((s, r) => s + r.minutes_late, 0);
  const lateDays      = lateReported + lateUnreported;
  const daysTracked   = active.length;   // expected (includes absent)
  const totalRows     = rows.length;
  const workDays      = totalRows;
  // List only knows unexplained absences, so every absence here is unreported
  const reported      = lateReported;
  const unreported    = lateUnreported + absent;
  const avgMinLate    = lateRows.length > 0 ? sumLate / lateRows.length : 0;
  const onTimeRate    = daysTracked > 0 ? (onTime / daysTracked) * 100 : 0;
  const lateRate      = daysTracked > 0 ? (lateDays / daysTracked) * 100 : 0;
  return {
    daysTracked, onTime, lateReported, lateUnreported, lateDays, excused, permission, absent,
    reported, unreported, totalRows, workDays, avgMinLate, onTimeRate, lateRate,
  };
}

// ── Arrival scatter (day-by-day) ──────────────────────────────────────────

export type ArrivalPoint = {
  date: string;       // "YYYY-MM-DD" — used as X label
  label: string;      // short formatted date
  minutesSinceMidnight: number | null;  // Y axis value
  color: string;      // dot color based on bucket/status
  status: string;
  entry_time: string | null;
  minutes_late: number;
};

/** Convert "HH:MM" (24h) string to minutes since midnight */
function hmToMinutes(hm: string | null): number | null {
  if (!hm) return null;
  const [h, m] = hm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

const BUCKET_COLORS: Record<string, string> = {
  'On Time':                '#2AA876',
  'late_1to10':             '#FBBF24',
  'late_11to30':            '#D97706',
  'late_830plus':           '#EF4444',
  'Excused (PTO/FH/Perm)':  '#94A3B8',
  'Permission':             '#6366F1',
  'Absent - Unexplained':   '#B91C1C',
};

function arrivalColor(row: AttendanceRow): string {
  if (row.status === 'Excused (PTO/FH/Perm)') return BUCKET_COLORS['Excused (PTO/FH/Perm)'];
  if (row.status === 'Permission')             return BUCKET_COLORS['Permission'];
  if (row.status === 'Absent - Unexplained')   return BUCKET_COLORS['Absent - Unexplained'];
  if (row.status === 'On Time')                return BUCKET_COLORS['On Time'];
  return BUCKET_COLORS[row.bucket ?? 'late_830plus'] ?? '#EF4444';
}

/** Normalize a date value that may arrive as a Date object or ISO string → "YYYY-MM-DD" */
function toDateStr(val: unknown): string {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val);
  return s.slice(0, 10);
}

function fmtShortDate(dateStr: string): string {
  const safe = toDateStr(dateStr);
  if (!safe) return '—';
  const d = new Date(safe + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

export function computeArrivalScatter(rows: AttendanceRow[]): ArrivalPoint[] {
  return [...rows]
    .map(r => ({ ...r, date: toDateStr(r.date) }))
    .filter(r => r.date.length === 10)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({
      date: r.date,
      label: fmtShortDate(r.date),
      minutesSinceMidnight: hmToMinutes(r.entry_time),
      color: arrivalColor(r),
      status: r.status,
      entry_time: r.entry_time,
      minutes_late: r.minutes_late,
    }));
}
```

## `src/app/lib/attendanceReportTypes.ts` (whole file)

```ts
// Pure type declarations — no imports needed.
// Callers who need both types and runtime exports should import from attendanceReport.ts,
// which re-exports everything from here.

export type ReportEmployee = {
  id: number; name: string; email: string; role: string; manager: string;
  work_days: string;
  start_date: string | null;
  standard_start: string; standard_end: string;
  dst_start: string; dst_end: string;
  grace_minutes: number;
};

export type ReportPayrollRow = {
  employee_id: number; work_date: string;
  entry_time: string | null; exit_time: string | null;
  scheduled_start: string | null;
  late_minutes: number; early_leave_minutes: number;
  event_type_1: string; documentation: string; auto_notes: string;
  period_name: string;
};

export type ReportForm = {
  employee_id: number; form_date: string; form_type: string;
  reason: string; details: string; eta: string;
  submitted_at: string | null; employee_email_raw: string; monday_item_id: string;
};

export type ReportRequest = {
  employee_id: number; request_type: string; permission_type: string;
  start_date: string | null; end_date: string | null; return_date: string | null;
};

export type ReportPeriod = {
  period_name: string; start_date: string | null; end_date: string | null;
  processed_at: string | null;
};

export type ReportHoliday = { date: string; name: string };

export type Verdict =
  | 'on_time' | 'late_reported_on_time' | 'late_reported_late' | 'late_no_form'
  | 'absent_reported_on_time' | 'absent_reported_late' | 'unexplained_absence'
  | 'pto' | 'permission' | 'holiday' | 'not_processed';

export type ReportFormView = {
  type: string; reason: string; details: string; eta: string;
  submittedAt: string | null;
  submittedMinutes: number | null;
  onTime: boolean;
  mondayItemId: string;
};

export type ReportRow = {
  employeeId: number; employeeName: string; email: string;
  role: string; manager: string;
  date: string;
  scheduledStart: string;
  entryTime: string | null; exitTime: string | null;
  minutesLate: number; earlyLeaveMinutes: number;
  form: ReportFormView | null;
  allForms: ReportFormView[];
  coveredBy: { kind: 'pto' | 'permission' | 'holiday'; label: string } | null;
  verdict: Verdict;
  countsToScore: boolean;
  flags: {
    multipleForms: boolean;
    recordedUnexplainedButFormOnFile: boolean;
    formEmailUnrecognised: boolean;
    /** payroll labelled the day time off / permission, but no Monday request covers it */
    excusedInPayrollNoRequest: boolean;
  };
};

export type ReportSummary = {
  employeeId: number; employeeName: string; role: string; manager: string;
  expectedDays: number;
  onTime: number;
  lateDays: number;
  lateDaysWithoutForm: number;
  unexplainedAbsences: number;
  awayDays: number;
  formsFiled: number;
  formsOnTime: number;
  onTimeRate: number | null;
};

export type ReportHelpers = {
  isScheduledWorkDay: (date: Date, workDays: string | undefined) => boolean;
  getSchedule: (
    emp: { dst_start: string; dst_end: string; standard_start: string; standard_end: string; grace_minutes: number },
    date: Date,
    dstWindows: { year: number; us_dst_start: string; us_dst_end: string }[],
  ) => { start: string; end: string; grace: string };
  parseTimeToMinutes: (t: string) => number;
};

export type ReportInput = {
  dateFrom: string; dateTo: string;
  employees: ReportEmployee[];
  payrollRows: ReportPayrollRow[];
  forms: ReportForm[];
  requests: ReportRequest[];
  holidays: ReportHoliday[];
  periods: ReportPeriod[];
  dstWindows: { year: number; us_dst_start: string; us_dst_end: string }[];
  helpers: ReportHelpers;
};

export type ReportOutput = {
  rows: ReportRow[];
  perEmployee: ReportSummary[];
  unmatchedForms: number;
};
```

## Report
- Byte size of both files; confirm no other file changed; Attendance List and Reports render with no console errors.
