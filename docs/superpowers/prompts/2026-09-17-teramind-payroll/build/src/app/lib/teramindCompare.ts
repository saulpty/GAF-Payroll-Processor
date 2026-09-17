// Compares what Teramind's API says (earliest session start / latest session finish per person per
// day) with what payroll already holds for that day. Pure: numbers in, verdict out. Times arrive
// as whole minutes since midnight, computed in SQL, because the database layer rewrites
// date-looking text on its way to the browser. Used only by the admin comparison screen.

export type CompareRow = {
  employee_id: number;
  name: string;
  day: string;                       // YYYY-MM-DD (callers slice to 10 first)
  period_name: string | null;        // null = payroll has no row for this day
  pay_entry: string | null;          // payroll text exactly as stored, e.g. "8:56 AM"
  pay_exit: string | null;
  pay_entry_min: number | null;
  pay_exit_min: number | null;
  tm_entry_min: number | null;
  tm_exit_min: number | null;
  tm_exit_next_day: boolean | null;  // latest finish fell on the next calendar day
  sessions: number | null;
  longest_s: number | null;          // longest single session that day, seconds
  event_type_1: string | null;
  initial_status: string | null;
  touched_after_run: boolean | null; // payroll row changed after it was first written
};

export type CompareKind =
  | 'match'          // both sides have times and they agree to the minute
  | 'close'          // differ, but by no more than `closeMinutes`
  | 'different'      // differ by more
  | 'payroll_only'   // payroll has times, Teramind has no session
  | 'teramind_only'  // Teramind has sessions, payroll has no times (or no row at all)
  | 'both_empty';    // payroll row without times and no Teramind session: they agree

export type CompareVerdict = {
  kind: CompareKind;
  entryDiff: number | null;   // Teramind minus payroll, minutes
  exitDiff: number | null;
  worst: number | null;       // largest absolute difference
  longSession: boolean;       // a session over 16 h: a machine that was never logged out
  hasPayrollRow: boolean;
};

export const LONG_SESSION_SECONDS = 16 * 3600;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Difference on a 24-hour circle, so 00:35 (next day) vs "12:35 AM" is 0, not 1440. */
export function clockDiff(a: number, b: number): number {
  return ((((a - b) % 1440) + 1440 + 720) % 1440) - 720;
}

export function classifyRow(r: CompareRow, closeMinutes = 5): CompareVerdict {
  const hasPay = isNum(r.pay_entry_min) || isNum(r.pay_exit_min);
  const hasTm = isNum(r.tm_entry_min) || isNum(r.tm_exit_min);
  const longSession = isNum(r.longest_s) && r.longest_s > LONG_SESSION_SECONDS;
  const hasPayrollRow = r.period_name !== null && r.period_name !== undefined && r.period_name !== '';
  const base = { entryDiff: null, exitDiff: null, worst: null, longSession, hasPayrollRow };

  if (!hasPay && !hasTm) return { kind: 'both_empty', ...base };
  if (hasPay && !hasTm) return { kind: 'payroll_only', ...base };
  if (!hasPay && hasTm) return { kind: 'teramind_only', ...base };

  const entryDiff = isNum(r.tm_entry_min) && isNum(r.pay_entry_min) ? clockDiff(r.tm_entry_min, r.pay_entry_min) : null;
  const exitDiff = isNum(r.tm_exit_min) && isNum(r.pay_exit_min) ? clockDiff(r.tm_exit_min, r.pay_exit_min) : null;
  const parts = [entryDiff, exitDiff].filter(isNum).map((d) => Math.abs(d));
  // One side has an entry but no exit (or the reverse): that is a difference, not a match.
  const lopsided = (entryDiff === null) !== (exitDiff === null) || parts.length === 0;
  const worst = parts.length ? Math.max(...parts) : null;
  let kind: CompareKind = 'different';
  if (!lopsided && worst === 0) kind = 'match';
  else if (!lopsided && worst !== null && worst <= closeMinutes) kind = 'close';
  return { kind, entryDiff, exitDiff, worst, longSession, hasPayrollRow };
}

export type CompareSummary = Record<CompareKind, number> & { total: number; longSessions: number; touched: number };

export function summarize(rows: CompareRow[], closeMinutes = 5): CompareSummary {
  const s: CompareSummary = {
    match: 0, close: 0, different: 0, payroll_only: 0, teramind_only: 0, both_empty: 0,
    total: 0, longSessions: 0, touched: 0,
  };
  for (const r of rows) {
    const v = classifyRow(r, closeMinutes);
    s[v.kind] += 1;
    s.total += 1;
    if (v.longSession) s.longSessions += 1;
    if (r.touched_after_run && v.kind !== 'match' && v.kind !== 'both_empty') s.touched += 1;
  }
  return s;
}

/** Whole minutes since midnight to "8:56 AM". */
export function fmtMinutes(m: number | null | undefined): string {
  if (!isNum(m)) return '—';
  const mm = ((Math.trunc(m) % 1440) + 1440) % 1440;
  const h24 = Math.floor(mm / 60);
  const min = String(mm % 60).padStart(2, '0');
  const h12 = h24 % 12 || 12;
  return `${h12}:${min} ${h24 >= 12 ? 'PM' : 'AM'}`;
}
