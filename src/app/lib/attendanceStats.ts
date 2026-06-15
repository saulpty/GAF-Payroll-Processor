export const EXCUSED_STATUSES  = ['Excused (PTO/FH/Perm)'];
export const PERMISSION_STATUSES = ['Permission'];

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
};

export type EmpInfo = {
  email: string;
  name: string;
  schedule_name: string;
  standard_start: string;
  standard_end: string;
};

export function isExcluded(status: string) {
  return EXCUSED_STATUSES.includes(status) || PERMISSION_STATUSES.includes(status);
}

export type EmpStats = {
  email: string;
  name: string;
  schedule: string;
  days: number;
  onTime: number;
  totalLate: number;
  reported: number;
  unreported: number;
  excused: number;
  permission: number;
  avgMinLate: number;
  pctOnTime: number;
  b1to10: number;
  b11to30: number;
  b31plus: number;
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
    const active = empRows.filter(r => !isExcluded(r.status));
    const onTime = active.filter(r => r.status === 'On Time').length;
    const reported = active.filter(r => r.status === 'Late - Reported').length;
    const unreported = active.filter(r => r.status === 'Late - Unreported').length;
    const excused = empRows.filter(r => r.status === 'Excused (PTO/FH/Perm)').length;
    const permission = empRows.filter(r => r.status === 'Permission').length;
    const sumMin = active.reduce((s, r) => s + r.minutes_late, 0);
    const avgMinLate = active.length > 0 ? sumMin / active.length : 0;
    const days = active.length;
    const pctOnTime = days > 0 ? (onTime / days) * 100 : 0;
    const b1to10  = active.filter(r => r.bucket === 'late_1to10').length;
    const b11to30 = active.filter(r => r.bucket === 'late_11to30').length;
    const b31plus = active.filter(r => r.bucket === 'late_830plus').length;
    return {
      email,
      name: info?.name ?? email,
      schedule: info ? `${info.standard_start} – ${info.standard_end}` : '—',
      days, onTime, totalLate: reported + unreported,
      reported, unreported, excused, permission,
      avgMinLate, pctOnTime, b1to10, b11to30, b31plus,
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
  avgMinLate: number;
  onTimeRate: number;
};

export function computeCompanyKpis(rows: AttendanceRow[]): CompanyKpis {
  const active = rows.filter(r => !isExcluded(r.status));
  const onTime = active.filter(r => r.status === 'On Time').length;
  const lateReported = active.filter(r => r.status === 'Late - Reported').length;
  const lateUnreported = active.filter(r => r.status === 'Late - Unreported').length;
  const excused = rows.filter(r => r.status === 'Excused (PTO/FH/Perm)').length;
  const permission = rows.filter(r => r.status === 'Permission').length;
  const sumMin = active.reduce((s, r) => s + r.minutes_late, 0);
  const daysTracked = active.length;
  const avgMinLate = daysTracked > 0 ? sumMin / daysTracked : 0;
  const onTimeRate = daysTracked > 0 ? (onTime / daysTracked) * 100 : 0;
  return { daysTracked, onTime, lateReported, lateUnreported, excused, permission, avgMinLate, onTimeRate };
}

// Trends helpers
export type TrendPoint = {
  key: string;
  label: string;
  tracked: number;
  onTime: number;
  sumMin: number;
  isPartial: boolean;
};

function isoWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d.getTime() + diff * 86400000);
  return mon.toISOString().slice(0, 10);
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function fmtMonth(key: string): string {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

function fmtWeek(key: string): string {
  const d = new Date(key + 'T00:00:00');
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

export function computeTrends(
  rows: AttendanceRow[],
  gran: 'month' | 'week'
): TrendPoint[] {
  const groups = new Map<string, TrendPoint>();

  rows.forEach(r => {
    if (isExcluded(r.status)) return;
    const key = gran === 'month' ? monthKey(r.date) : isoWeekMonday(r.date);
    const label = gran === 'month' ? fmtMonth(key) : fmtWeek(key);
    if (!groups.has(key)) groups.set(key, { key, label, tracked: 0, onTime: 0, sumMin: 0, isPartial: false });
    const g = groups.get(key)!;
    g.tracked++;
    if (r.status === 'On Time') g.onTime++;
    g.sumMin += r.minutes_late;
  });

  const sorted = Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));

  // Mark partial: last period
  if (sorted.length > 0) {
    const last = sorted[sorted.length - 1];
    const today = new Date().toISOString().slice(0, 10);
    if (gran === 'month') {
      const maxDay = rows.filter(r => r.date.slice(0, 7) === last.key).reduce((m, r) => r.date > m ? r.date : m, '');
      last.isPartial = maxDay.slice(8, 10) < '25';
    } else {
      // partial week if today's ISO week is the same week
      const weekOfToday = isoWeekMonday(today);
      last.isPartial = last.key >= weekOfToday;
    }
  }

  return sorted;
}
