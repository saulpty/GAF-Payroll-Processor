// Reconciles one PTO / floating-holiday request with what payroll actually
// recorded. Pure: no React, no imports, no Date. Dates are YYYY-MM-DD strings
// compared as strings; every input is sliced to 10 chars at the boundary
// because Postgres DATE arrives as an ISO timestamp (LESSONS.md).
//
// Definitions (decided with Saul, 2026-09-09):
//   - a day OFF is a payroll row with no clock-in whose event type is a leave
//     type (PTO / Permiso Remunerado / Feriado); for a floating holiday it is
//     a row whose pay impact is the FH/B-day marker;
//   - the actual RETURN is the first punched row after the first day off whose
//     event type is not a leave type (a punched PTO day is "worked during
//     leave", not a return);
//   - PTO days are calendar days from first day off to the return — weekends
//     count; floating-holiday days are the number of off rows.
// Days someone does not work produce no payroll row at all, so weekends never
// appear here; that is why PTO must count by span and not by rows.

export interface DayRow {
  d: string;          // work date, YYYY-MM-DD
  et: string;         // event_type_1
  pi: string;         // pay_impact_1
  p: string;          // period_name
  in: boolean;        // has a clock-in
}

export interface PeriodRow {
  period_name: string;
  start_date: string | null;
  end_date: string | null;
  processed_at: string | null;
}

export interface MatchRequest { leaveOn: string; returnOn: string; days: number }

export interface MatchOpts {
  leaveType: 'pto' | 'floating_holiday';
  today: string;
  spanDays: (a: string, b: string) => number;   // defaultTotalDays from ptoAccrual
  stopBefore?: string | null;                   // the next request's leaveOn, exclusive
}

export type MatchState = 'matched' | 'partial' | 'not_processed' | 'future' | 'no_rows' | 'worked' | 'invalid';

export interface PayrollMatch {
  state: MatchState;
  mismatch: boolean;
  cycles: string[];
  firstOff: string | null;
  lastOff: string | null;
  actualReturn: string | null;
  actualDays: number | null;
  byType: { label: string; count: number; impact: string }[];
  dataThrough: string | null;   // last end_date payroll has been processed through
  payrollCovers: boolean;       // payroll is processed through the return date
  invalidDates: boolean;        // return before leave on the request itself
}

export type RecordReason = 'future' | 'not_processed' | 'invalid' | null;

/** One rule for the Record button, the record dialog and the review badge. */
export function recordability(
  match: PayrollMatch,
  returnOn: string,
  today: string,
  spanDays: (a: string, b: string) => number,
): { ok: boolean; reason: RecordReason; daysUntil: number | null } {
  const ret = ymd(returnOn);
  if (match.invalidDates) return { ok: false, reason: 'invalid', daysUntil: null };
  if (ret > today) return { ok: false, reason: 'future', daysUntil: spanDays(today, ret) };
  if (!match.payrollCovers) return { ok: false, reason: 'not_processed', daysUntil: null };
  return { ok: true, reason: null, daysUntil: null };
}

const OFF_TYPES = new Set(['PTO', 'Permiso Remunerado', 'Feriado']);
const FH_IMPACT = 'floating holiday / b-day off';

function ymd(v: unknown): string {
  return v ? String(v).slice(0, 10) : '';
}

function truthy(v: unknown): boolean {
  return v === true || v === 'true' || v === 't' || v === 1 || v === '1';
}

interface Row { d: string; et: string; pi: string; piRaw: string; p: string; in: boolean }

function normalise(rows: DayRow[], stopBefore: string | null | undefined): Row[] {
  const stop = ymd(stopBefore);
  const out: Row[] = [];
  for (const r of rows ?? []) {
    const d = ymd(r.d);
    if (!d) continue;
    if (stop && d >= stop) continue;
    out.push({
      d,
      et: String(r.et ?? '').trim(),
      pi: String(r.pi ?? '').trim().toLowerCase(),
      piRaw: String(r.pi ?? '').trim(),
      p: String(r.p ?? '').trim(),
      in: truthy(r.in),
    });
  }
  out.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return out;
}

function tally(rows: Row[]): { label: string; count: number; impact: string }[] {
  // One entry per event + impact pair, first-seen order, so the same event
  // with two impacts (Incapacidad vs Constancia Medica) stays two lines.
  const out: { label: string; count: number; impact: string }[] = [];
  for (const r of rows) {
    const base = r.et || 'no event';
    const label = r.in && OFF_TYPES.has(r.et) ? `${base} (worked)` : base;
    const hit = out.find(e => e.label === label && e.impact === r.piRaw);
    if (hit) hit.count++;
    else out.push({ label, count: 1, impact: r.piRaw });
  }
  return out;
}

function distinctCycles(rows: Row[]): string[] {
  const out: string[] = [];
  for (const r of rows) if (r.p && !out.includes(r.p)) out.push(r.p);
  return out;
}

export function matchPayroll(
  req: MatchRequest,
  dayRows: DayRow[],
  periods: PeriodRow[],
  opts: MatchOpts,
): PayrollMatch {
  const leaveOn = ymd(req.leaveOn);
  const returnOn = ymd(req.returnOn);
  const reqDays = Number(req.days) || 0;
  const rows = normalise(dayRows, opts.stopBefore);
  const isFh = opts.leaveType === 'floating_holiday';

  const processed = (periods ?? []).filter(p => !!p.processed_at && !!p.start_date && !!p.end_date);
  let dataThrough: string | null = null;
  for (const p of processed) {
    const e = ymd(p.end_date);
    if (!dataThrough || e > dataThrough) dataThrough = e;
  }
  const processedCovers = (d: string) =>
    processed.some(p => d >= ymd(p.start_date) && d <= ymd(p.end_date));

  const isOff = (r: Row) => !r.in && (isFh ? r.pi === FH_IMPACT : OFF_TYPES.has(r.et));
  const isRet = (r: Row) => r.in && !OFF_TYPES.has(r.et);
  const inSpan = (d: string) => d >= leaveOn && (d < returnOn || d === leaveOn);

  const payrollCovers = !!dataThrough && dataThrough >= returnOn;
  const invalidDates = !!leaveOn && !!returnOn && returnOn < leaveOn;
  const base: PayrollMatch = {
    state: 'no_rows', mismatch: false, cycles: [], firstOff: null, lastOff: null,
    actualReturn: null, actualDays: null, byType: [], dataThrough, payrollCovers, invalidDates,
  };
  if (invalidDates) return { ...base, state: 'invalid' };

  const spanRows = rows.filter(r => inSpan(r.d));
  const first = spanRows.find(isOff);

  if (!first) {
    if (spanRows.length > 0) {
      const anyUnpunched = spanRows.some(r => !r.in);
      // Rows exist but none is a day off of this leave type. If they all carry
      // punches the person worked; if some are unpunched they were off for a
      // different reason (an FH recorded as PTO, an absence) — say so and flag.
      return {
        ...base,
        state: anyUnpunched ? 'matched' : 'worked',
        mismatch: anyUnpunched,
        actualDays: anyUnpunched ? 0 : null,
        cycles: distinctCycles(spanRows),
        byType: tally(spanRows),
      };
    }
    if (leaveOn > opts.today) return { ...base, state: 'future' };
    return { ...base, state: processedCovers(leaveOn) ? 'no_rows' : 'not_processed' };
  }

  const after = rows.filter(r => r.d >= first.d);
  const ret = after.find(r => r.d > first.d && isRet(r)) ?? null;
  const range = ret ? after.filter(r => r.d < ret.d) : after;
  const offRows = range.filter(isOff);
  const lastOff = offRows.length ? offRows[offRows.length - 1].d : first.d;

  const actualDays = isFh
    ? offRows.length
    : ret ? opts.spanDays(first.d, ret.d) : null;

  const state: MatchState = ret
    ? 'matched'
    : dataThrough && dataThrough >= returnOn ? 'matched' : 'partial';

  const mismatch = state === 'matched'
    && (first.d !== leaveOn || actualDays === null || actualDays !== reqDays);

  return {
    state,
    mismatch,
    cycles: distinctCycles(range),
    firstOff: first.d,
    lastOff,
    actualReturn: ret ? ret.d : null,
    actualDays,
    byType: tally(range),
    dataThrough,
    payrollCovers,
    invalidDates,
  };
}
