// Activity days: a pure combinator over Teramind day rows plus the attendance report.
// Zero runtime imports, no Date maths: dates are 'YYYY-MM-DD' strings, compared as
// strings and advanced by addDays(). Contract 2026-09-18.

import type { ReportRow, ReportRequest } from './attendanceReportTypes';

export type WhyKind = 'pto' | 'permission' | 'sick' | 'form' | 'holiday' | 'wfh' | 'day_off' | 'none';
export type WhyChip = { kind: WhyKind; label: string; tone: 'blue' | 'amber' | 'gray' };

export type ActivitySettings = {
  minActiveMinutes: number;   // 390 on a 480-min shift
  breakMinutes: number; breakOverMinutes: number;
};

export type ActivityDayRow = {
  employee_id: number; work_date: number;
  first_min: number; last_ymd: number; last_min: number;
  active_s: number; records: number; largest_gap_min: number; gap_start_min: number;
  has_manual: boolean; accounts: number; synced_at: string;
};

export type ActivityEmployee = {
  id: number; name: string; role: string; manager: string;
  work_days: string; schedule_start: string; schedule_end: string;
};

export type ActivityDay = {
  employeeId: number; employeeName: string; role: string; manager: string;
  date: string; scheduled: boolean; shiftMinutes: number;
  firstMin: number | null; lastMin: number | null; crossesMidnight: boolean;
  activeMin: number; breaksMin: number; largestGapMin: number; gapStartMin: number;
  records: number; accounts: number; hasManual: boolean;
  official: boolean; edited: boolean;
  officialEntryMin: number | null; officialExitMin: number | null;
  why: WhyChip | null;
  flag: 'low_activity' | 'long_break' | null;
  needsLook: boolean; isToday: boolean;
};

export type EmployeeActivitySummary = {
  employeeId: number; employeeName: string; role: string; manager: string;
  scheduledDays: number; daysWorked: number;
  avgActiveMin: number | null; avgFirstMin: number | null; avgLastMin: number | null;
  needsLook: number; awayDays: number; awayLabel: string;
  days: ActivityDay[];   // newest first
};

export type ActivityTotals = {
  avgActiveMin: number | null; daysWorked: number; needsLook: number; lateArrivals: number;
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number) => (n < 10 ? '0' + n : String(n));

export const ymd10 = (v: string | null | undefined): string => (typeof v === 'string' ? v.slice(0, 10) : '');

/** 20260911 -> '2026-09-11'. */
export function toYmd(n: number): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '';
  return `${Math.floor(v / 10000)}-${pad2(Math.floor(v / 100) % 100)}-${pad2(v % 100)}`;
}

function daysInMonth(y: number, m: number): number {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31;
}

export function addDays(date: string, n: number): string {
  let y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  let d = Number(date.slice(8, 10)) + Math.max(0, Math.floor(n));
  if (!y || !m || !d) return date;
  for (let dim = daysInMonth(y, m); d > dim; dim = daysInMonth(y, m)) {
    d -= dim;
    if (++m > 12) { m = 1; y += 1; }
  }
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** '2026-09-16' -> 'Wed Sep 16' (Sakamoto, no Date). */
export function fmtDayShort(ymd: string): string {
  const s = ymd10(ymd);
  const y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)), d = Number(s.slice(8, 10));
  if (!y || !m || !d || m < 1 || m > 12) return s;
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const yy = m < 3 ? y - 1 : y;
  const n = yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[m - 1]! + d;
  return `${DOW[((n % 7) + 7) % 7]} ${MON[m - 1]} ${d}`;
}

/** '8:02 AM' or '08:02' -> minutes since midnight. */
export function parseClock(t: string | null | undefined): number | null {
  const m = /(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?/i.exec(typeof t === 'string' ? t : '');
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (min > 59) return null;
  if (m[3]) return ((h % 12) + (/p/i.test(m[3]) ? 12 : 0)) * 60 + min;
  return h > 23 ? null : h * 60 + min;
}

/** Title Case; PTO stays PTO. */
export function titleCase(s: string): string {
  return String(s ?? '').trim().split(/\s+/)
    .map((w) => (/^[A-Z0-9]+$/.test(w) && w.length <= 4 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

/** Spanish payroll labels, in English. */
export function payrollLabelToEnglish(label: string): string {
  const raw = String(label ?? '').trim(), low = raw.toLowerCase();
  if (raw === '') return '';
  if (low.startsWith('incapacidad')) return 'Sick';
  if (low.startsWith('permiso') || low === 'permission') return 'Permission';
  if (low.startsWith('feriado')) return 'Holiday';
  return low === 'pto' ? 'PTO' : titleCase(raw);
}

// 480 when unknown.
export function shiftMinutesOf(start: string, end: string): number {
  const s = parseClock(start), e = parseClock(end);
  if (s === null || e === null) return 480;
  const span = e > s ? e - s : e + 1440 - s;
  return span > 0 && span <= 1440 ? span : 480;
}

export const thresholdFor = (shiftMinutes: number, settings: ActivitySettings): number =>
  (Number.isFinite(Number(settings?.minActiveMinutes))
    ? Math.round(shiftMinutes * (Number(settings.minActiveMinutes) / 480)) : 0);

// Mirrors attendanceReport.requestCoversDate.
function coversDate(r: ReportRequest, date: string): boolean {
  const s = ymd10(r.start_date);
  if (!s || date < s) return false;
  const ret = ymd10(r.return_date);
  if (ret && ret > s) return date < ret;
  return date <= (ymd10(r.end_date) || s);
}

// "8-12", "8:00 AM - 12:00 PM", "8 a 12".
const TIME_RANGE = /\d{1,2}(?::\d{2})?\s*(?:[ap]\.?\s*m\.?)?\s*(?:[-–—]|\bto\b|\ba\b)\s*\d{1,2}/i;
const SICK_FORM = /sick|incapacidad|attendance/;
// Legitimately away: never a flag, never Needs A Look.
const EXCUSED: WhyKind[] = ['pto', 'permission', 'sick', 'form', 'holiday', 'day_off'];
const AWAY: WhyKind[] = ['pto', 'permission', 'sick', 'form', 'holiday'];
const chip = (kind: WhyKind, label: string, tone: WhyChip['tone'] = 'blue'): WhyChip => ({ kind, label, tone });

export function whyFor(args: {
  reportRow: ReportRow | null; requests: ReportRequest[];
  scheduled: boolean; hasActivity: boolean;
}): WhyChip | null {
  const rr = args.reportRow;
  const reqs = args.requests ?? [];
  const date = rr ? ymd10(rr.date) : '';
  const mine = (r: ReportRequest) => !rr || Number(r.employee_id) === Number(rr.employeeId);

  if (rr && rr.coveredBy) {
    const en = payrollLabelToEnglish(rr.coveredBy.label);
    if (rr.coveredBy.kind === 'holiday') {
      return chip('holiday', en && en !== 'Holiday' ? `Holiday · ${en}` : 'Holiday', 'gray');
    }
    if (rr.coveredBy.kind === 'permission') {
      const req = reqs.find((r) => mine(r) && TIME_RANGE.test(String(r.permission_type ?? '')) && coversDate(r, date));
      const hours = req ? String(req.permission_type).trim() : '';
      return chip('permission', hours ? `Permission ${hours}` : 'Permission');
    }
    // 'pto': the payroll label may mean sick or holiday.
    if (en === 'Sick') return chip('sick', 'Sick');
    return en === 'Holiday' ? chip('holiday', 'Holiday', 'gray') : chip('pto', 'PTO');
  }
  if (rr && rr.form) {
    const type = String(rr.form.type ?? '').trim();
    // "Absence" with reason "Sick" is a sick day: the reason is the why.
    if (SICK_FORM.test(`${type} ${rr.form.reason ?? ''}`.toLowerCase())) return chip('sick', 'Sick');
    return chip('form', titleCase(type) || 'Form');
  }
  if (args.scheduled && args.hasActivity && date
    && reqs.some((r) => mine(r) && /work from home|wfh/i.test(String(r.request_type ?? '')) && coversDate(r, date))) {
    return chip('wfh', 'WFH', 'gray');
  }
  if (!args.scheduled && args.hasActivity) return chip('day_off', 'Day Off', 'gray');
  if (args.scheduled && !args.hasActivity) return chip('none', 'No Reports Yet', 'amber');
  return null;
}

const toInt = (v: unknown, dflt: number): number => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : dflt);
const toMin = (v: unknown): number | null => (toInt(v, -1) >= 0 ? toInt(v, -1) : null);
function avg(vals: (number | null)[]): number | null {
  const ns = vals.filter((v): v is number => v !== null);
  return ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : null;
}
const isWorked = (d: ActivityDay) => d.records > 0 || d.firstMin !== null;
const differs = (a: number | null, b: number | null) => a !== null && b !== null && Math.abs(a - b) >= 1;

export function buildActivityDays(input: {
  dateFrom: string; dateTo: string; today: string;
  employees: ActivityEmployee[]; rows: ActivityDayRow[];
  reportRows: ReportRow[]; requests: ReportRequest[];
  settings: ActivitySettings;
  isScheduledWorkDay: (emp: unknown, date: string) => boolean;
}): { days: ActivityDay[]; byEmployee: EmployeeActivitySummary[]; totals: ActivityTotals } {
  const { settings, isScheduledWorkDay } = input;
  const todayYmd = ymd10(input.today);
  const lastDate = ymd10(input.dateTo);

  const rowMap = new Map<string, ActivityDayRow>();
  for (const r of input.rows ?? []) rowMap.set(`${Number(r.employee_id)}|${toYmd(r.work_date)}`, r);
  const reportMap = new Map<string, ReportRow>();
  for (const rr of input.reportRows ?? []) reportMap.set(`${Number(rr.employeeId)}|${ymd10(rr.date)}`, rr);
  const reqByEmp = new Map<number, ReportRequest[]>();
  for (const r of input.requests ?? []) {
    const list = reqByEmp.get(Number(r.employee_id));
    if (list) list.push(r); else reqByEmp.set(Number(r.employee_id), [r]);
  }

  const days: ActivityDay[] = [];
  const byEmployee: EmployeeActivitySummary[] = [];
  let lateArrivals = 0;

  for (const emp of input.employees ?? []) {
    const who = { employeeId: Number(emp.id), employeeName: emp.name, role: emp.role, manager: emp.manager };
    const empRequests = reqByEmp.get(Number(emp.id)) ?? [];
    const shiftMinutes = shiftMinutesOf(emp.schedule_start, emp.schedule_end);
    const threshold = thresholdFor(shiftMinutes, settings);
    const empDays: ActivityDay[] = [];

    let date = ymd10(input.dateFrom);
    while (date !== '' && date <= lastDate) {
      const cur = date;
      date = addDays(cur, 1);
      const key = `${Number(emp.id)}|${cur}`;
      const row = rowMap.get(key) ?? null;
      const rr = reportMap.get(key) ?? null;
      const scheduled = isScheduledWorkDay(emp, cur) === true;
      const records = toInt(row?.records, 0);
      const firstMin = toMin(row?.first_min);
      const hasActivity = records > 0 || firstMin !== null;

      // Not scheduled, nothing happened: no row.
      if (!scheduled && !hasActivity) continue;

      const lastYmd = row ? toYmd(row.last_ymd) : '';
      const lastMin = toMin(row?.last_min);
      const crossesMidnight = lastYmd !== '' && lastYmd > cur;
      const span = firstMin !== null && lastMin !== null
        ? (crossesMidnight ? lastMin + 1440 : lastMin) - firstMin : null;
      let activeMin = Math.floor(toInt(row?.active_s, 0) / 60);
      // Accounts can overlap: active can exceed the span.
      if (span !== null && span >= 0 && activeMin > span) activeMin = span;
      const breaksMin = span !== null ? Math.max(0, span - activeMin) : 0;

      const why = whyFor({ reportRow: rr, requests: empRequests, scheduled, hasActivity });
      const excused = why !== null && EXCUSED.indexOf(why.kind) >= 0;
      let flag: 'low_activity' | 'long_break' | null = null;
      if (scheduled && cur < todayYmd && !excused) {
        if (!hasActivity || activeMin < threshold) flag = 'low_activity';
        else if (breaksMin > settings.breakMinutes + settings.breakOverMinutes) flag = 'long_break';
      }

      const officialEntryMin = rr ? parseClock(rr.entryTime) : null;
      const officialExitMin = rr ? parseClock(rr.exitTime) : null;
      const official = rr !== null && rr.verdict !== 'not_processed';
      const edited = official && (differs(officialEntryMin, firstMin) || differs(officialExitMin, lastMin));

      const startMin = parseClock(rr ? rr.scheduledStart : '') ?? parseClock(emp.schedule_start);
      if (scheduled && firstMin !== null && startMin !== null && firstMin > startMin) lateArrivals += 1;

      empDays.push({
        ...who,
        date: cur, scheduled, shiftMinutes, firstMin, lastMin, crossesMidnight, activeMin, breaksMin,
        largestGapMin: toInt(row?.largest_gap_min, 0), gapStartMin: toInt(row?.gap_start_min, 0),
        records, accounts: row ? toInt(row.accounts, 1) : 0, hasManual: row?.has_manual === true,
        official, edited, officialEntryMin, officialExitMin, why, flag,
        needsLook: flag === 'low_activity', isToday: cur === todayYmd,
      });
    }
    if (empDays.length === 0) continue;
    for (const d of empDays) days.push(d);

    const worked = empDays.filter(isWorked);
    const away = empDays.map((d) => d.why).filter((w): w is WhyChip => w !== null && AWAY.indexOf(w.kind) >= 0);
    const words = new Set(away.map((c) => (c.kind === 'holiday' ? 'Holiday' : c.kind === 'permission' ? 'Permission' : c.label)));
    byEmployee.push({
      ...who,
      scheduledDays: empDays.filter((d) => d.scheduled).length,
      daysWorked: worked.length,
      avgActiveMin: avg(worked.map((d) => d.activeMin)),
      avgFirstMin: avg(worked.map((d) => d.firstMin)),
      avgLastMin: avg(worked.map((d) => d.lastMin)),
      needsLook: empDays.filter((d) => d.needsLook).length,
      awayDays: away.length,
      awayLabel: away.length ? `${away.length} · ${[...words].join(', ')}` : '',
      days: empDays.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    });
  }

  const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  days.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : byName(a.employeeName, b.employeeName)));
  byEmployee.sort((a, b) => byName(a.employeeName, b.employeeName));

  const workedAll = days.filter(isWorked);
  return {
    days,
    byEmployee,
    totals: {
      avgActiveMin: avg(workedAll.map((d) => d.activeMin)),
      daysWorked: workedAll.length,
      needsLook: days.filter((d) => d.needsLook).length,
      lateArrivals,
    },
  };
}
