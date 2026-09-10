# 06 — Pure modules: impact per event, coverage rule, period-name guard

## Files you may change

- `src/app/lib/ptoPayrollMatch.ts` — replace the whole file with the source below, verbatim
- `src/app/lib/periodName.ts` — **new**, source below, verbatim

**No other file.** No page, action, component, migration or test. Both files
stay well under 15 KB. No `toISOString()`. No imports in either module.

What changes in `ptoPayrollMatch.ts` (already reflected in the source):
`byType` entries carry `impact` (original-case `pay_impact_1`) and split by
event + impact; `PayrollMatch` gains `payrollCovers` and `invalidDates`;
`MatchState` gains `'invalid'` (return before leave); new export
`recordability()` is the single rule for whether a Monday request can be
recorded (invalid → future → not processed → ok).

`periodName.ts` is the guard against the `Q1-Aug-20260` incident: trim,
canonical shape, and a near-miss check against existing names.

## `src/app/lib/ptoPayrollMatch.ts`

```ts
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
```

## `src/app/lib/periodName.ts`

```ts
// Period-name hygiene for Process Payroll. Pure, no imports.
//
// 2026-09-10: a period was run twice, once as "Q1-Aug-2026" and once as
// "Q1-Aug-20260". The typo produced a second set of payroll rows for the same
// days and nothing in the app could tell. These three helpers are the guard:
// the name is trimmed, must have the canonical shape, and must not be a
// near-miss of a period that already exists (that is a re-run, pick it).

const CANON = /^Q[12]-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4}$/;

export function normalizePeriodName(s: string | null | undefined): string {
  return String(s ?? '').trim();
}

export function isCanonical(s: string | null | undefined): boolean {
  return CANON.test(normalizePeriodName(s));
}

function key(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Levenshtein distance, capped: returns early once it exceeds `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * The existing period name this one is probably a typo of, or null.
 * An exact match (after trimming) is NOT a near match — that is a deliberate
 * re-run. Differences of case or punctuation only, one string being a prefix
 * of the other, or a single edit all count.
 */
export function nearMatch(s: string | null | undefined, existing: string[]): string | null {
  const name = normalizePeriodName(s);
  if (!name) return null;
  const t = key(name);
  if (!t) return null;
  for (const e of existing) {
    if (normalizePeriodName(e) === name) return null;
  }
  // Rank every candidate and return the closest, so "q1-aug-2026" resolves to
  // Q1-Aug-2026 (same letters) and not to Q2-Aug-2026 (one edit away).
  let best: { name: string; score: number } | null = null;
  for (const e of existing) {
    const en = normalizePeriodName(e);
    const k = key(en);
    if (!k) continue;
    let score: number | null = null;
    if (k === t) score = 0;
    else if (Math.abs(k.length - t.length) <= 2 && (t.startsWith(k) || k.startsWith(t))) score = 1;
    else if (editDistance(k, t, 1) <= 1) score = 2;
    if (score !== null && (best === null || score < best.score)) best = { name: en, score };
  }
  return best ? best.name : null;
}
```

## Acceptance

1. `node --test "tests/*.test.ts"` → `tests/ptoPayrollMatch.test.ts` M1–M24 and
   `tests/periodName.test.ts` P1–P5 green; nothing else changes (241 total).
2. Only the two files above changed. The PTO page still renders exactly as
   before — nothing reads the new fields yet.
