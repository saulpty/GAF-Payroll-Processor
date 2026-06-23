// GAF Planilla Classification Engine — implements Section 6 of the handoff spec

export interface EmployeeRecord {
  id: number;
  display_name: string;
  teramind_email: string;
  is_grace_list: boolean;
  is_macbook_swap: boolean;
  schedule_name: string;
  dst_start: string;   // e.g. "8:00 AM"
  dst_end: string;
  standard_start: string;
  standard_end: string;
  grace_minutes: number;
}

export interface DstWindow {
  year: number;
  us_dst_start: string; // "2026-03-08"
  us_dst_end: string;
}

export interface TeramindRow {
  email: string;
  timeStarted: Date;
  timeFinished: Date;
}

export interface MondayAttendanceRow {
  employeeName: string;
  employeeEmail?: string; // teramind_email from board
  date: string; // YYYY-MM-DD
  type: 'Tardiness' | 'Absence';
  reason?: string;
  notes?: string;
}

export interface MondayAdjustmentRow {
  employeeName: string;
  employeeEmail?: string;
  date: string;
  adjustmentType: string;
}

export interface MondayPermissionRow {
  employeeName: string;
  employeeEmail?: string;
  startDate: string;
  endDate: string;
  requestType: string;
  status: string;
}

export interface PayrollEntry {
  period_name: string;
  employee_id: number;
  work_date: string;         // "2026-04-11 (Sat)"
  entry_time: string | null;
  exit_time: string | null;
  scheduled_start: string;
  grace_until: string;
  scheduled_end: string;
  late_minutes: number;
  late_after_grace: number;
  early_leave_minutes: number;
  discount_total_minutes: number;
  payroll_ready: string;
  event_type_1: string;
  pay_impact_1: string;
  event_type_2: string;
  pay_impact_2: string;
  documentation: string;
  notes: string;
  auto_notes: string;
  initial_status: string;
  status_current: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Format a Date as "YYYY-MM-DD (Day)" */
export function formatWorkDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dayName = DAY_NAMES[d.getDay()];
  return `${y}-${m}-${day} (${dayName})`;
}

/** Format a Date as local-calendar "YYYY-MM-DD".
 *  Uses the same local fields as formatWorkDate so date-keys and displayed
 *  work-dates always agree — independent of the runtime timezone. */
export function toLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format Date as 12-hr "8:07 AM" */
export function formatTime12(d: Date): string {
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

/** Parse "8:00 AM" to minutes-since-midnight. Returns 0 for blank input; a
 *  non-blank value that doesn't parse is a data error (e.g. a malformed schedule
 *  time) — we warn and fall back to 0 rather than failing silently. */
export function parseTimeToMinutes(t: string): number {
  if (!t) return 0;
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) {
    console.warn(`[parseTimeToMinutes] unparseable time "${t}" - treated as 00:00; check the schedule values.`);
    return 0;
  }
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

/** Add minutes to "8:00 AM" string */
function addMinutesToTimeStr(t: string, mins: number): string {
  const total = parseTimeToMinutes(t) + mins;
  const h24 = Math.floor(total / 60) % 24;
  const min = total % 60;
  const fakeDate = new Date(2000, 0, 1, h24, min);
  return formatTime12(fakeDate);
}

/** Check if a date is within the US DST window.
 *  Defensive about DB types: SQL drivers may return the integer `year` as a
 *  string and the date bounds as full timestamps, so coerce year with Number()
 *  and take only the YYYY-MM-DD prefix. Without this, a string year matched
 *  nothing and isDst silently returned false (no DST offset ever applied). */
export function isDst(date: Date, dstWindows: DstWindow[]): boolean {
  const year = date.getFullYear();
  const win = dstWindows.find(w => Number(w.year) === year);
  if (!win) return false;
  const start = new Date(String(win.us_dst_start).slice(0, 10) + 'T00:00:00');
  const end = new Date(String(win.us_dst_end).slice(0, 10) + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
  return date >= start && date < end;
}

/** Convert a Teramind UTC-Eastern timestamp to Panama time.
 *  Panama = UTC-5 year-round.
 *  Teramind is Eastern: EDT (UTC-4) during DST, EST (UTC-5) during standard.
 *  During DST: Panama = Eastern - 1 hr. Standard: Panama = Eastern (no change).
 */
export function teramindToPanama(ts: Date, dstWindows: DstWindow[]): Date {
  if (isDst(ts, dstWindows)) {
    return new Date(ts.getTime() - 60 * 60 * 1000);
  }
  return new Date(ts.getTime());
}

/** Parse a flexible date-time string from Teramind CSV */
export function parseTeramindTimestamp(s: string): Date | null {
  if (!s) return null;
  // Try ISO and common formats
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

/** Normalize name for accent/case-insensitive matching */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Get schedule times for a given date, in the DISPLAY timezone (US Eastern).
 *  Schedule columns are stored directly in US Eastern: `dst_*` is the Summer (ET)
 *  pair and `standard_*` is the Winter (ET) pair. We pick the summer pair during
 *  US DST and the winter pair otherwise — no conversion (stored value == shown).
 *
 *  For Eastern-synced employees the two pairs are identical (e.g. 9-5 / 9-5). For
 *  employees whose team ignores US DST (e.g. Favian, Arizona) they differ — 10-6
 *  summer / 9-5 winter. (The `dst_*`/`standard_*` column names are historical;
 *  they now hold Eastern summer/winter values.) */
export function getSchedule(
  emp: EmployeeRecord,
  date: Date,
  dstWindows: DstWindow[]
): { start: string; end: string; grace: string } {
  const summer = isDst(date, dstWindows);
  const start = summer ? emp.dst_start : emp.standard_start;
  const end = summer ? emp.dst_end : emp.standard_end;
  const grace = addMinutesToTimeStr(start, emp.grace_minutes);
  return { start, end, grace };
}

// Full-day unpaid event types — these consume an entire day's worth of hours
const FULL_DAY_UNPAID_EVENTS = [
  'Permiso No remunerado',
  'Ausencia Injustificada',
  'Ausencia Justificada.',
  'Ausencia Justificada',
  'Unpaid Leave',
  'Leave Without Pay',
  'LWOP',
];

const FULL_DAY_DISCOUNT_MINUTES = 480; // 8h default; classificationEngine cfg overrides this at run-time

/** Compute discount_total_minutes per Section 6.3.
 *  Discounts are keyed off the EVENT TYPE in each slot, not the slot number —
 *  "Tardanza" and "Salida Temprano" can each land in slot 1 or slot 2 depending
 *  on what else happened that day, so we look for them in either slot.
 *  Full-day unpaid events (Permiso No remunerado, absences, etc.) with pay_impact
 *  "Unpaid" produce a full-day discount.
 */
export function computeDiscount(entry: Partial<PayrollEntry>, fullDayMinutes = FULL_DAY_DISCOUNT_MINUTES): number {
  const et1 = entry.event_type_1 || '';
  const et2 = entry.event_type_2 || '';
  const pi1 = entry.pay_impact_1 || '';
  const pi2 = entry.pay_impact_2 || '';
  const lm = entry.late_minutes || 0;
  const lag = entry.late_after_grace || 0;
  const elm = entry.early_leave_minutes || 0;

  const unpaidImpacts = ['', 'Unpaid', 'Unpaid (with Grace)', 'Unpaid (without Grace)'];
  let discount = 0;

  // Full-day unpaid events — check both slots
  for (const [et, pi] of [[et1, pi1], [et2, pi2]] as [string, string][]) {
    if (FULL_DAY_UNPAID_EVENTS.includes(et) && pi === 'Unpaid') {
      discount = Math.max(discount, fullDayMinutes);
    }
  }

  // Tardiness — discount applies to whichever slot holds "Tardanza".
  const tardinessPi = et1 === 'Tardanza' ? pi1 : et2 === 'Tardanza' ? pi2 : null;
  if (tardinessPi !== null) {
    if (tardinessPi === 'Unpaid (with Grace)') discount += lag;
    if (tardinessPi === 'Unpaid (without Grace)' || tardinessPi === 'Unpaid') discount += lm;
  }

  // Early leave — discount applies to whichever slot holds "Salida Temprano".
  const earlyPi = et1 === 'Salida Temprano' ? pi1 : et2 === 'Salida Temprano' ? pi2 : null;
  if (earlyPi !== null && unpaidImpacts.includes(earlyPi)) {
    discount += elm;
  }

  return discount;
}

/** Compute payroll_ready and status_current per Section 6.4.
 *
 * A row is payroll_ready=YES only if:
 *   (a) initial_status is GREEN (clean day, outage, full-day perm, macbook-swap) — always ready, OR
 *   (b) initial_status is YELLOW/RED AND the operator has resolved it:
 *       - et1 is set AND pi1 is filled in
 *       - if et2 is also set, pi2 must be filled in too
 *
 * Rows where the ENGINE auto-set pi1 (e.g. "Unpaid (without Grace)") are NOT
 * considered resolved — the operator must confirm/change them in Action Required.
 * Those rows keep payroll_ready=NO until the operator explicitly saves.
 */
export function computeDerivedFields(entry: Partial<PayrollEntry>, fullDayMinutes?: number): {
  discount_total_minutes: number;
  payroll_ready: string;
  status_current: string;
} {
  const discount = computeDiscount(entry, fullDayMinutes);
  const et1 = entry.event_type_1 || '';
  const et2 = entry.event_type_2 || '';
  const pi1 = entry.pay_impact_1 || '';
  const pi2 = entry.pay_impact_2 || '';
  const initial = entry.initial_status || 'GREEN';

  let payroll_ready: string;

  if (initial === 'GREEN') {
    // GREEN rows are always ready (no operator action needed)
    payroll_ready = 'YES';
  } else {
    // YELLOW/RED: ready when all present event_types have a pay_impact assigned
    const et1Ok = et1 === '' || pi1 !== '';
    const et2Ok = et2 === '' || pi2 !== '';
    // Must have at least et1 filled to be resolvable, and all filled slots must have impacts
    payroll_ready = (et1 !== '' && et1Ok && et2Ok) ? 'YES' : 'NO';
  }

  const status_current = payroll_ready === 'YES' ? 'GREEN' : initial;
  return { discount_total_minutes: discount, payroll_ready, status_current };
}

// ── Classification config (DB-driven, editable) ─────────────────────────────

export interface ClassificationConfig {

  non_grace_auto_resolve: boolean;          // default true — non-grace late auto-resolves GREEN/Unpaid
  non_grace_auto_impact: string;            // default 'Unpaid (without Grace)'
  early_leave_auto_impact: string;          // default '' (operator decides)
  full_day_absence_discount_minutes: number; // default 420 (flat "7 paid hours" policy)
}

export const DEFAULT_CLASSIFICATION_CONFIG: ClassificationConfig = {
  non_grace_auto_resolve: true,
  non_grace_auto_impact: 'Unpaid (without Grace)',
  early_leave_auto_impact: '',
  full_day_absence_discount_minutes: 420,
};

/** Build a ClassificationConfig from raw DB rows (key/value pairs). */
export function buildClassificationConfig(
  rows: { key: string; value: string }[]
): ClassificationConfig {
  const get = (k: string, fallback: string) =>
    rows.find(r => r.key === k)?.value ?? fallback;
  return {

    non_grace_auto_resolve: get('non_grace_auto_resolve', 'true') === 'true',
    non_grace_auto_impact: get('non_grace_auto_impact', 'Unpaid (without Grace)'),
    early_leave_auto_impact: get('early_leave_auto_impact', ''),
    full_day_absence_discount_minutes: parseInt(get('full_day_absence_discount_minutes', '420'), 10) || 420,
  };
}

// ── Main classification engine ──────────────────────────────────────────

export interface EngineInput {
  periodName: string;
  startDate: string;    // YYYY-MM-DD
  endDate: string;
  employees: EmployeeRecord[];
  dstWindows: DstWindow[];
  holidays: { date: string; name: string }[];
  teramindData: Map<string, Map<string, { entry: Date; exit: Date }>>;  // email → date → {entry,exit}
  mondayAttendance: MondayAttendanceRow[];
  mondayAdjustments: MondayAdjustmentRow[];
  mondayPermissions: MondayPermissionRow[];
  outageDates: string[];       // YYYY-MM-DD strings
  midDayPull: boolean;
  excludedEmployeeIds: number[];
  nameMap: Map<string, number>;   // normalized name → employee id (built from display_name + aliases)
  config?: ClassificationConfig;  // optional; falls back to DEFAULT_CLASSIFICATION_CONFIG
}

function dateRange(start: string, end: string): Date[] {
  const dates: Date[] = [];
  const cur = new Date(start + 'T12:00:00');
  const last = new Date(end + 'T12:00:00');
  while (cur <= last) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function toYMD(d: Date): string {
  return toLocalYMD(d);
}

/** Returns true if this Monday row belongs to the given employee.
 *  Order: email-first, then alias resolution via nameMap, then direct name match.
 *  nameMap (normalized name -> employee id, built from display_name + aliases) is
 *  what lets board rows that use a name variant still attach to the right person. */
function rowMatchesEmp(
  rowEmail: string | undefined,
  rowName: string,
  empEmail: string,
  empName: string,
  empId?: number,
  nameMap?: Map<string, number>,
): boolean {
  if (rowEmail && rowEmail.trim()) {
    return rowEmail.trim().toLowerCase() === empEmail.toLowerCase();
  }
  const norm = normalizeName(rowName);
  if (nameMap && empId !== undefined && nameMap.get(norm) === empId) return true;
  return norm === normalizeName(empName);
}

function permissionCoversDate(perm: MondayPermissionRow, dateStr: string): boolean {
  return dateStr >= perm.startDate && dateStr <= perm.endDate;
}

export function runClassificationEngine(input: EngineInput): PayrollEntry[] {
  const {
    periodName, employees, dstWindows, holidays, teramindData,
    mondayAttendance, mondayAdjustments, mondayPermissions,
    outageDates, midDayPull, excludedEmployeeIds, nameMap,
  } = input;

  const cfg: ClassificationConfig = { ...DEFAULT_CLASSIFICATION_CONFIG, ...(input.config ?? {}) };

  const holidaySet = new Set(holidays.map(h => h.date.slice(0, 10)));
  const outageSet = new Set(outageDates);
  const results: PayrollEntry[] = [];

  const allDates = dateRange(input.startDate, input.endDate);

  for (const emp of employees) {
    if (excludedEmployeeIds.includes(emp.id)) continue;

    for (const date of allDates) {
      const dateStr = toYMD(date);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const sched = getSchedule(emp, date, dstWindows);
      const wd = formatWorkDate(date);

      const baseEntry: Omit<PayrollEntry, 'event_type_1' | 'pay_impact_1' | 'event_type_2' | 'pay_impact_2' | 'documentation' | 'notes' | 'auto_notes' | 'initial_status' | 'status_current' | 'payroll_ready' | 'discount_total_minutes'> = {
        period_name: periodName,
        employee_id: emp.id,
        work_date: wd,
        entry_time: null,
        exit_time: null,
        scheduled_start: sched.start,
        grace_until: sched.grace,
        scheduled_end: sched.end,
        late_minutes: 0,
        late_after_grace: 0,
        early_leave_minutes: 0,
      };

      // ── Step 0: Outage date ──
      if (outageSet.has(dateStr)) {
        const entry = buildEntry(baseEntry, {
          entry_time: sched.start, exit_time: sched.end,
          event_type_1: '', pay_impact_1: '', event_type_2: '', pay_impact_2: '',
          documentation: 'System Generated', notes: '',
          auto_notes: 'Teramind outage — default schedule applied.',
          initial_status: 'GREEN',
        });
        results.push(entry);
        continue;
      }

      // ── Weekend ── (not silently dropped — flagged YELLOW)
      if (isWeekend) {
        // Only create if there is any data for this employee on this day
        const tmData = teramindData.get(emp.teramind_email)?.get(dateStr);
        const hasMonday = mondayAttendance.some(r => rowMatchesEmp(r.employeeEmail, r.employeeName, emp.teramind_email, emp.display_name, emp.id, nameMap) && r.date === dateStr)
          || mondayPermissions.some(r => rowMatchesEmp(r.employeeEmail, r.employeeName, emp.teramind_email, emp.display_name, emp.id, nameMap) && permissionCoversDate(r, dateStr));
        if (tmData || hasMonday) {
          const entryT = tmData ? formatTime12(tmData.entry) : null;
          const exitT = tmData ? formatTime12(tmData.exit) : null;
          const entry = buildEntry({ ...baseEntry, entry_time: entryT, exit_time: exitT }, {
            event_type_1: '', pay_impact_1: '', event_type_2: '', pay_impact_2: '',
            documentation: '', notes: '',
            auto_notes: 'Weekend activity detected — operator review required.',
            initial_status: 'YELLOW',
          });
          results.push(entry);
        }
        continue;
      }

      // Teramind entry/exit for this employee on this date
      let tmEntry = teramindData.get(emp.teramind_email)?.get(dateStr) || null;

      // Mid-day pull: Teramind was exported before the day ended, so exits look
      // artificially early. If the recorded exit is well before the scheduled end,
      // backfill it to the employee's scheduled end (DST-aware) — NOT a hardcoded
      // clock time. Schedules end at 3/4/5 PM depending on the person and season.
      if (tmEntry && midDayPull) {
        const exitMins = tmEntry.exit.getHours() * 60 + tmEntry.exit.getMinutes();
        const schedEndMins = parseTimeToMinutes(sched.end);
        if (exitMins < schedEndMins - 30) {
          const defaultExit = new Date(tmEntry.exit);
          defaultExit.setHours(Math.floor(schedEndMins / 60), schedEndMins % 60, 0, 0);
          tmEntry = { entry: tmEntry.entry, exit: defaultExit };
        }
      }

      const entryTimeStr = tmEntry ? formatTime12(tmEntry.entry) : null;
      const exitTimeStr = tmEntry ? formatTime12(tmEntry.exit) : null;

      // Attendance/absence forms for this employee+date
      const absenceForms = mondayAttendance.filter(
        r => rowMatchesEmp(r.employeeEmail, r.employeeName, emp.teramind_email, emp.display_name, emp.id, nameMap) && r.date === dateStr && r.type === 'Absence'
      );
      const tardinessForms = mondayAttendance.filter(
        r => rowMatchesEmp(r.employeeEmail, r.employeeName, emp.teramind_email, emp.display_name, emp.id, nameMap) && r.date === dateStr && r.type === 'Tardiness'
      );
      const adjustments = mondayAdjustments.filter(
        r => rowMatchesEmp(r.employeeEmail, r.employeeName, emp.teramind_email, emp.display_name, emp.id, nameMap) && r.date === dateStr
      );
      const permissions = mondayPermissions.filter(
        r => rowMatchesEmp(r.employeeEmail, r.employeeName, emp.teramind_email, emp.display_name, emp.id, nameMap) && permissionCoversDate(r, dateStr)
      );

      // ── Step 1: Holiday ──
      if (holidaySet.has(dateStr)) {
        // Auto-resolve to GREEN/Paid – Sin Compensatorio.
        // If employee has Teramind data (worked the holiday), escalate to YELLOW for operator to assign Compensatorio.
        const workedHoliday = !!tmEntry;
        const entry = buildEntry({ ...baseEntry, entry_time: entryTimeStr, exit_time: exitTimeStr }, {
          event_type_1: 'Feriado',
          pay_impact_1: workedHoliday ? '' : 'Paid – Sin Compensatorio',
          event_type_2: '', pay_impact_2: '',
          documentation: workedHoliday ? '' : '',
          notes: '',
          auto_notes: workedHoliday
            ? 'Holiday — employee has Teramind data (worked?). Assign Compensatorio or confirm Paid – Sin Compensatorio.'
            : 'Holiday — auto-resolved: Paid – Sin Compensatorio.',
          initial_status: workedHoliday ? 'YELLOW' : 'GREEN',
        });
        results.push(entry);
        continue;
      }

      // ── Step 2: Full-day permission ──
      const PAID_PERM_TYPES   = ['PTO', 'Vacation', 'Floating Holiday', 'Compensatory Day', 'Birthday Day Off', 'Time for Time (Days)'];
      const UNPAID_PERM_TYPES = ['Unpaid Leave', 'Permiso No remunerado', 'Leave Without Pay', 'LWOP'];

      const fullDayPerm = permissions.find(p =>
        [...PAID_PERM_TYPES, ...UNPAID_PERM_TYPES].some(
          t => p.requestType.toLowerCase().includes(t.toLowerCase())
        ) && p.status.toLowerCase() !== 'rejected'
      );
      if (fullDayPerm) {
        const rtLower = fullDayPerm.requestType.toLowerCase();
        const isUnpaidPerm = UNPAID_PERM_TYPES.some(t => rtLower.includes(t.toLowerCase()));
        let et1 = isUnpaidPerm ? 'Permiso No remunerado' : 'Permiso Remunerado';
        let pi1 = isUnpaidPerm ? 'Unpaid' : 'Paid';
        if (!isUnpaidPerm) {
          if (rtLower.includes('pto') || rtLower.includes('vacation')) {
            et1 = 'PTO';
            pi1 = 'Paid';
          } else if (rtLower.includes('time for time')) {
            pi1 = '';
          }
        }
        const isTftPerm = rtLower.includes('time for time');
        const entry = buildEntry({ ...baseEntry }, {
          event_type_1: et1, pay_impact_1: pi1,
          event_type_2: '', pay_impact_2: '',
          documentation: 'Form Submitted', notes: '',
          auto_notes: `Permission: ${fullDayPerm.requestType}${isTftPerm ? ' — TFT on file, operator must review.' : ''}`,
          initial_status: isTftPerm ? 'YELLOW' : 'GREEN',
        });
        results.push(entry);
        continue;
      }

      // ── Step 3: Absence form ──
      if (absenceForms.length > 0) {
        const form = absenceForms[0];
        const reasonLower = (form.reason || '').toLowerCase();
        const isSick = reasonLower.includes('sick') || reasonLower.includes('medical')
          || reasonLower.includes('enferm') || reasonLower.includes('incapacidad')
          || reasonLower.includes('doctor') || reasonLower.includes('médic') || reasonLower.includes('medic');
        const suggestedPi1 = isSick ? 'Incapacidad' : 'Paid – Exception';
        const doc = isSick ? 'Doctor Note – Pending' : 'Form Submitted';

        // #3: If absence form filed BUT Teramind shows they worked → RED conflict
        if (tmEntry) {
          const entry = buildEntry({ ...baseEntry, entry_time: entryTimeStr, exit_time: exitTimeStr }, {
            event_type_1: 'Ausencia Justificada.', pay_impact_1: '',
            event_type_2: '', pay_impact_2: '',
            documentation: doc, notes: '',
            auto_notes: `⚠ CONFLICT: Absence form filed (${form.reason || 'N/A'}) but Teramind shows activity (${entryTimeStr} – ${exitTimeStr}). Operator must resolve.`,
            initial_status: 'RED',
          });
          results.push(entry);
          continue;
        }

        // Check for partial Constancia Médica (time range in notes)
        const timeRangeMatch = (form.notes || '').match(/(\d+)\s*(?:am|pm)\s*-\s*(\d+)\s*(?:am|pm)/i);
        if (isSick && timeRangeMatch) {
          const entry = buildEntry({ ...baseEntry, entry_time: entryTimeStr, exit_time: exitTimeStr }, {
            event_type_1: 'Ausencia Justificada.', pay_impact_1: '',
            event_type_2: 'Ausencia Injustificada', pay_impact_2: '',
            documentation: 'Doctor Note – Pending', notes: '',
            auto_notes: `Absence form (Sick). Partial medical note: ${form.notes}. Remainder → Ausencia Injustificada. (Suggested: Constancia Medica)`,
            initial_status: 'YELLOW',
          });
          results.push(entry);
        } else {
          const entry = buildEntry({ ...baseEntry, entry_time: null, exit_time: null }, {
            event_type_1: 'Ausencia Justificada.', pay_impact_1: '',
            event_type_2: '', pay_impact_2: '',
            documentation: doc, notes: '',
            auto_notes: `Absence form. Reason: ${form.reason || 'N/A'} (Suggested: ${suggestedPi1})`,
            initial_status: 'YELLOW',
          });
          results.push(entry);
        }
        continue;
      }

      // ── Step 4: Macbook-swap, no Teramind data ──
      if (emp.is_macbook_swap && !tmEntry) {
        const entry = buildEntry({ ...baseEntry, entry_time: sched.start, exit_time: sched.end }, {
          event_type_1: '', pay_impact_1: '',
          event_type_2: '', pay_impact_2: '',
          documentation: '', notes: 'Macbook swap',
          auto_notes: 'Macbook swap — default schedule.',
          initial_status: 'GREEN',
        });
        results.push(entry);
        continue;
      }

      // ── Step 5: No data + no form ──
      if (!tmEntry) {
        const entry = buildEntry({ ...baseEntry }, {
          event_type_1: 'Ausencia Injustificada', pay_impact_1: '',
          event_type_2: '', pay_impact_2: '',
          documentation: '', notes: '',
          auto_notes: 'NO DATA + NO FORM (Suggested: Unpaid)',
          initial_status: 'RED',
        });
        // Flat full-day absence discount (configurable; default 420 = 7 paid hours).
        entry.discount_total_minutes = cfg.full_day_absence_discount_minutes;
        results.push(entry);
        continue;
      }

      // ── Step 6: WFH ──
      const wfhPerm = permissions.find(p => p.requestType.toLowerCase().includes('wfh'));
      const isWfh = !!wfhPerm;

      // ── Step 7: Normal day with data ──
      const schedStartMins = parseTimeToMinutes(sched.start);
      const schedEndMins = parseTimeToMinutes(sched.end);
      const entryMins = tmEntry.entry.getHours() * 60 + tmEntry.entry.getMinutes();
      const exitMins = tmEntry.exit.getHours() * 60 + tmEntry.exit.getMinutes();

      const late_minutes = Math.max(0, entryMins - schedStartMins);
      const late_after_grace = Math.max(0, late_minutes - emp.grace_minutes);
      const early_leave_minutes = Math.max(0, schedEndMins - exitMins);

      const hasTardForm = tardinessForms.length > 0;
      // TFT = Time-for-Time detection:
      // Adjustments board (compensation type): "Time for Time", "Late Time Payback (Tardiness Compensation)", "tft", "time adjustment"
      // Permissions board (permission type): "Time for Time", "Time for Time (days)", "tft"
      const hasTft = adjustments.some(a => {
          const t = a.adjustmentType.toLowerCase();
          return t.includes('time for time') || t.includes('tft') || t.includes('time adjustment') || t.includes('late time payback');
        }) || permissions.some(p => {
          const t = p.requestType.toLowerCase();
          return t.includes('time for time') || t.includes('tft');
        });

      let et1 = '', pi1 = '', et2 = '', pi2 = '';
      let doc = '', notes = '', autoNotes = '';
      let initial_status = 'GREEN';

      // Tardiness logic
      if (late_minutes > 0) {
        et1 = 'Tardanza';

        // Rule: TFT on file → always YELLOW regardless of minutes late.
        // Operator reviews and sets pay impact manually.
        if (hasTft) {
          pi1 = '';
          initial_status = 'YELLOW';
          autoNotes = `Late ${late_minutes} min. TFT on file — operator must review.`;

        // Grace-list employees
        // Policy: grace only applies if (a) form filed AND (b) late ≤ grace_minutes.
        // Any other case → Unpaid auto-resolved GREEN (same as non-grace).
        // Exception: TFT on file is already handled above before reaching here.
        } else if (emp.is_grace_list) {
          if (hasTardForm && late_minutes <= emp.grace_minutes) {
            // ✓ Form filed + within grace window → Paid (Grace), GREEN
            pi1 = 'Paid (Grace)';
            initial_status = 'GREEN';
            autoNotes = `Late ${late_minutes} min, within grace (${emp.grace_minutes} min), form filed. Auto-resolved: Paid (Grace).`;
          } else if (hasTardForm && late_minutes > emp.grace_minutes) {
            // Form filed but exceeded grace → only discount minutes past grace, Unpaid (with Grace), GREEN
            pi1 = 'Unpaid (with Grace)';
            initial_status = 'GREEN';
            autoNotes = `Late ${late_minutes} min (${late_after_grace} after grace). Form filed. Auto-resolved: Unpaid (with Grace).`;
          } else {
            // No form filed → Unpaid auto GREEN (same as non-grace)
            pi1 = cfg.non_grace_auto_impact;
            initial_status = 'GREEN';
            autoNotes = `Late ${late_minutes} min — NO FORM. Auto-resolved: ${cfg.non_grace_auto_impact}.`;
          }

        // Not on grace list
        } else if (cfg.non_grace_auto_resolve) {
          // Auto-resolve with configured impact
          pi1 = cfg.non_grace_auto_impact;
          initial_status = 'GREEN';
          autoNotes = hasTardForm
            ? `Late ${late_minutes} min. Form filed. Auto-resolved: ${cfg.non_grace_auto_impact}.`
            : `Late ${late_minutes} min. No form. Auto-resolved: ${cfg.non_grace_auto_impact}.`;
        } else {
          // Auto-resolve disabled — leave for operator
          pi1 = '';
          initial_status = 'YELLOW';
          autoNotes = hasTardForm
            ? `Late ${late_minutes} min. Form filed. (Suggested: ${cfg.non_grace_auto_impact})`
            : `Late ${late_minutes} min. NO FORM. (Suggested: ${cfg.non_grace_auto_impact})`;
        }

        if (hasTardForm) doc = 'Form Submitted';
      }

      // Early leave logic
      if (early_leave_minutes > 0) {
        // Determine which slot to use: et1 if empty, et2 if et1 taken
        const slot = et1 === '' ? 'et1' : (et2 === '' ? 'et2' : null);
        const elImpact = cfg.early_leave_auto_impact;

        if (slot === null) {
          // Both event slots already occupied (e.g. grace-split tardiness).
          // Cannot add a 3rd event — flag it prominently in notes so operator knows.
          if (initial_status !== 'RED') initial_status = 'YELLOW';
          autoNotes += ` ⚠ Early leave ${early_leave_minutes} min — BOTH event slots taken; manually add Salida Temprano.`;
        } else if (hasTft) {
          if (slot === 'et2') { et2 = 'Salida Temprano'; pi2 = ''; }
          else { et1 = 'Salida Temprano'; pi1 = ''; }
          if (initial_status !== 'RED') initial_status = 'YELLOW';
          autoNotes += ` Early leave ${early_leave_minutes} min. TFT on file — verify.`;
        } else if (elImpact) {
          if (slot === 'et2') { et2 = 'Salida Temprano'; pi2 = elImpact; }
          else { et1 = 'Salida Temprano'; pi1 = elImpact; }
          autoNotes += ` Early leave ${early_leave_minutes} min. Auto-resolved: ${elImpact}.`;
        } else {
          if (slot === 'et2') { et2 = 'Salida Temprano'; pi2 = ''; }
          else { et1 = 'Salida Temprano'; pi1 = ''; }
          if (initial_status !== 'RED') initial_status = 'YELLOW';
          autoNotes += ` Early leave ${early_leave_minutes} min. Assign pay impact.`;
        }
      }

      if (late_minutes === 0 && early_leave_minutes === 0) {
        autoNotes = 'On time, full shift.';
        initial_status = 'GREEN';
      }

      if (isWfh) {
        // WFH employees follow normal rules — just note it in auto_notes
        autoNotes = autoNotes
          ? `WFH. ${autoNotes}`
          : 'WFH — on time, full shift.';
      }

      const fullEntry: PayrollEntry = {
        ...baseEntry,
        entry_time: entryTimeStr,
        exit_time: exitTimeStr,
        late_minutes,
        late_after_grace,
        early_leave_minutes,
        discount_total_minutes: 0,
        event_type_1: et1,
        pay_impact_1: pi1,
        event_type_2: et2,
        pay_impact_2: pi2,
        documentation: doc,
        notes,
        auto_notes: autoNotes.trim(),
        initial_status,
        status_current: 'GREEN',
        payroll_ready: 'NO',
      };

      const derived = computeDerivedFields(fullEntry);
      fullEntry.discount_total_minutes = derived.discount_total_minutes;
      fullEntry.payroll_ready = derived.payroll_ready;
      fullEntry.status_current = derived.status_current;

      results.push(fullEntry);
    }
  }

  return results;
}

function buildEntry(
  base: Omit<PayrollEntry, 'event_type_1' | 'pay_impact_1' | 'event_type_2' | 'pay_impact_2' | 'documentation' | 'notes' | 'auto_notes' | 'initial_status' | 'status_current' | 'payroll_ready' | 'discount_total_minutes'>,
  overrides: {
    event_type_1: string; pay_impact_1: string;
    event_type_2: string; pay_impact_2: string;
    documentation: string; notes: string; auto_notes: string;
    initial_status: string;
    entry_time?: string | null; exit_time?: string | null;
  }
): PayrollEntry {
  const partial: Partial<PayrollEntry> = {
    ...base,
    entry_time: overrides.entry_time !== undefined ? overrides.entry_time : base.entry_time,
    exit_time: overrides.exit_time !== undefined ? overrides.exit_time : base.exit_time,
    event_type_1: overrides.event_type_1,
    pay_impact_1: overrides.pay_impact_1,
    event_type_2: overrides.event_type_2,
    pay_impact_2: overrides.pay_impact_2,
    documentation: overrides.documentation,
    notes: overrides.notes,
    auto_notes: overrides.auto_notes,
    initial_status: overrides.initial_status,
  };
  const derived = computeDerivedFields(partial);
  return {
    ...partial,
    discount_total_minutes: derived.discount_total_minutes,
    payroll_ready: derived.payroll_ready,
    status_current: derived.status_current,
  } as PayrollEntry;
}
