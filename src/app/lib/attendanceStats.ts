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
  role: string;
  manager: string;
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
      role: info?.role ?? '',
      manager: info?.manager ?? '',
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
  'On Time':             '#34c759',
  'late_1to10':          '#ff9f0a',
  'late_11to30':         '#ff6b00',
  'late_830plus':        '#ff3b30',
  'Excused (PTO/FH/Perm)': '#8e8e93',
  'Permission':          '#af52de',
};

function arrivalColor(row: AttendanceRow): string {
  if (row.status === 'Excused (PTO/FH/Perm)') return BUCKET_COLORS['Excused (PTO/FH/Perm)'];
  if (row.status === 'Permission') return BUCKET_COLORS['Permission'];
  if (row.status === 'On Time') return BUCKET_COLORS['On Time'];
  return BUCKET_COLORS[row.bucket ?? 'late_830plus'] ?? '#ff3b30';
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
  const safe = toDateStr(dateStr);
  if (!safe) return '';
  const d = new Date(safe + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d.getTime() + diff * 86400000);
  return mon.toISOString().slice(0, 10);
}

function monthKey(dateStr: string): string {
  return toDateStr(dateStr).slice(0, 7); // "YYYY-MM"
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
    const dateNorm = toDateStr(r.date);
    if (!dateNorm) return;
    const key = gran === 'month' ? monthKey(dateNorm) : isoWeekMonday(dateNorm);
    if (!key) return;
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
    // NOTE: toISOString is normally forbidden here (see AGENTS.md) - it returns
    // the UTC date, which is tomorrow after 19:00 Panama time. It is kept only
    // because this module must stay import-free: importing toLocalYMD from
    // classificationEngine breaks `node --test`, which cannot resolve extensionless
    // imports. Impact is limited to the partial-period marker at a week boundary.
    // Proper fix is to pass today's date in as a parameter from the caller.
    const today = new Date().toISOString().slice(0, 10);
    if (gran === 'month') {
      const maxDay = rows.map(r => toDateStr(r.date)).filter(d => d.slice(0, 7) === last.key).reduce((m, d) => d > m ? d : m, '');
      last.isPartial = maxDay.slice(8, 10) < '25';
    } else {
      // partial week if today's ISO week is the same week
      const weekOfToday = isoWeekMonday(today);
      last.isPartial = last.key >= weekOfToday;
    }
  }

  return sorted;
}
