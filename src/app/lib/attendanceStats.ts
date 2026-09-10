export const EXCUSED_STATUSES  = ['Excused (PTO/FH/Perm)'];
export const PERMISSION_STATUSES = ['Permission'];
export const ABSENT_STATUSES   = ['Absent - Unexplained'];

export type AttendanceRow = {
  email: string;
  name: string;
  date: string;
  entry_time: string | null;
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
  daysTracked: number;
  onTime: number;
  lateReported: number;
  lateUnreported: number;
  excused: number;
  permission: number;
  absent: number;
  totalRows: number;
  avgMinLate: number;
  onTimeRate: number;
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
  const sumMin        = arrived.reduce((s, r) => s + r.minutes_late, 0);
  const daysTracked   = active.length;   // expected (includes absent)
  const totalRows     = rows.length;
  const avgMinLate    = arrived.length > 0 ? sumMin / arrived.length : 0;
  const onTimeRate    = daysTracked > 0 ? (onTime / daysTracked) * 100 : 0;
  return { daysTracked, onTime, lateReported, lateUnreported, excused, permission, absent, totalRows, avgMinLate, onTimeRate };
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


