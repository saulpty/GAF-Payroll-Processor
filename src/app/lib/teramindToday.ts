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
