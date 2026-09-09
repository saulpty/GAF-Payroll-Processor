# 01 — Payroll day rows, floating-holiday days, two pure modules

## Files you may change

- `src/actions/loadPtoEmployeeDetail.ts`
- `src/actions/loadPtoBalancesInputs.ts`
- `src/app/lib/ptoPayrollMatch.ts` — **new**, source given below, copy it verbatim
- `src/app/lib/fmtDay.ts` — **new**, source given below, copy it verbatim

**No other file.** Do not touch any page, component, test, or migration. Do not
build any UI — the next prompt does that. Every file stays under 15 KB.
Identifiers in these files are camelCase (a snake_case name like `status_label`
trips the H4 hardcoding guard). No `toISOString()` anywhere.

---

## 1. `src/actions/loadPtoEmployeeDetail.ts`

### 1a. Add a third top-level key, `days`

Append it after the `fh` key (keep `pending`, `ledger` and `fh` exactly as they
are, including their `payroll` string subqueries — the next prompt removes
those once the UI stops reading them):

```sql
        , COALESCE((
          SELECT json_agg(json_build_object(
            'd',  LEFT(pe.work_date, 10),
            'et', COALESCE(NULLIF(TRIM(pe.event_type_1), ''), ''),
            'pi', COALESCE(pe.pay_impact_1, ''),
            'p',  pe.period_name,
            'in', NULLIF(TRIM(pe.entry_time), '') IS NOT NULL
          ) ORDER BY LEFT(pe.work_date, 10))
          FROM payroll_entries pe
          WHERE pe.employee_id = {{params.employee_id}}::bigint
            AND pe.deleted_at IS NULL
            AND LEFT(pe.work_date, 10) >= (({{params.year}}::int - 1)::text || '-12-01')
        ), '[]'::json) AS days
```

`{{params.year}}` and `{{params.employee_id}}` sit outside any quoted string —
UIB substitutes them whole. The `pe` alias is already used by the `fh`
sub-select for `pto_employees`; that is a separate scope, but to avoid any
confusion alias `payroll_entries` as `pr` in the new block if you prefer — the
column names are what matter.

### 1b. A withdrawn approval keeps its Monday link

In the `pending` block the join currently reads

```sql
LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id AND a.status <> 'withdrawn'
```

Remove `AND a.status <> 'withdrawn'`. A withdrawn record is now shown in the
ledger with a Restore button (next prompt); the request must **not** reappear
as pending at the same time.

## 2. `src/actions/loadPtoBalancesInputs.ts`

### 2a. Same join fix

The `pending_count` sub-select has the same `AND a.status <> 'withdrawn'` on its
join. Remove it.

### 2b. Floating holidays used = days, not records, and never below the sheet

Replace the `fh_used` sub-select with:

```sql
             GREATEST(COALESCE(fh.fh_used, 0),
               COALESCE((SELECT SUM(a.total_days) FROM pto_approvals a
                 WHERE a.employee_id = e.id AND a.leave_type = 'floating_holiday' AND a.status = 'recorded'
                   AND EXTRACT(YEAR FROM a.leave_on)::text = {{params.year}}::text), 0)) AS fh_used,
             COALESCE(fh.fh_used, 0) AS fh_sheet_used,
```

Why: one record of two floating-holiday days must count as two (Charles Bush
recorded 2 and still saw "FH left 1"). `pto_floating_holidays.fh_used` holds
the August spreadsheet's 2026 usage for people whose days were never recorded
here; `GREATEST` keeps whichever side knows more without double counting.
Other years have no sheet row, so `COALESCE` gives 0 and the SUM wins.

## 3. `src/app/lib/ptoPayrollMatch.ts` — new file, verbatim

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

export type MatchState = 'matched' | 'partial' | 'not_processed' | 'future' | 'no_rows' | 'worked';

export interface PayrollMatch {
  state: MatchState;
  mismatch: boolean;
  cycles: string[];
  firstOff: string | null;
  lastOff: string | null;
  actualReturn: string | null;
  actualDays: number | null;
  byType: { label: string; count: number }[];
  dataThrough: string | null;   // last end_date payroll has been processed through
}

const OFF_TYPES = new Set(['PTO', 'Permiso Remunerado', 'Feriado']);
const FH_IMPACT = 'floating holiday / b-day off';

function ymd(v: unknown): string {
  return v ? String(v).slice(0, 10) : '';
}

function truthy(v: unknown): boolean {
  return v === true || v === 'true' || v === 't' || v === 1 || v === '1';
}

interface Row { d: string; et: string; pi: string; p: string; in: boolean }

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
      p: String(r.p ?? '').trim(),
      in: truthy(r.in),
    });
  }
  out.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return out;
}

function tally(rows: Row[]): { label: string; count: number }[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const r of rows) {
    const base = r.et || 'no event';
    const label = r.in && OFF_TYPES.has(r.et) ? `${base} (worked)` : base;
    if (!counts.has(label)) order.push(label);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return order.map(label => ({ label, count: counts.get(label) ?? 0 }));
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

  const base: PayrollMatch = {
    state: 'no_rows', mismatch: false, cycles: [], firstOff: null, lastOff: null,
    actualReturn: null, actualDays: null, byType: [], dataThrough,
  };

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
  };
}
```

## 4. `src/app/lib/fmtDay.ts` — new file, verbatim

```ts
// Weekday-first date display for the PTO tracker: "Mon Aug 17", with the year
// appended only when it is not the current one. Everything here is integer
// arithmetic on YYYY-MM-DD strings — no Date object is ever constructed, so
// the timezone invariant in AGENTS.md holds by construction.

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(v: string | null | undefined): [number, number, number] | null {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Days since 1970-01-01 for a civil date (Howard Hinnant's days_from_civil). */
function dayNumber(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** 0 = Sunday … 6 = Saturday. -1 when the input is not a date. */
export function weekday(ymd: string | null | undefined): number {
  const p = parts(ymd);
  if (!p) return -1;
  return (((dayNumber(p[0], p[1], p[2]) + 4) % 7) + 7) % 7;
}

/** "Mon Aug 17", or "Mon Aug 17, 2027" when the year differs from thisYear. */
export function fmtDay(ymd: string | null | undefined, thisYear?: string): string {
  if (!ymd) return '';
  const p = parts(ymd);
  if (!p) return String(ymd);
  const base = `${WD[weekday(ymd)]} ${MON[p[1] - 1]} ${p[2]}`;
  return String(p[0]) === thisYear ? base : `${base}, ${p[0]}`;
}

/** "Mon Aug 17 → Fri Aug 21"; collapses to one day when the end is missing or equal. */
export function fmtRange(a: string | null | undefined, b: string | null | undefined, thisYear?: string): string {
  const s = fmtDay(a, thisYear);
  const e = fmtDay(b, thisYear);
  if (!e || e === s) return s;
  return `${s} → ${e}`;
}

/** Mon–Fri days in [leaveOn, returnOn). What a floating holiday spends; PTO uses calendar days instead. */
export function weekdayCount(leaveOn: string, returnOn: string): number {
  const a = parts(leaveOn);
  const b = parts(returnOn);
  if (!a || !b) return 0;
  const start = dayNumber(a[0], a[1], a[2]);
  const end = dayNumber(b[0], b[1], b[2]);
  let n = 0;
  for (let k = start; k < end; k++) {
    const wd = (((k + 4) % 7) + 7) % 7;
    if (wd >= 1 && wd <= 5) n++;
  }
  return n;
}
```

---

## Acceptance

1. `node --test "tests/*.test.ts"` — `tests/ptoPayrollMatch.test.ts` (M1–M20)
   and `tests/fmtDay.test.ts` (D1–D4) go green; nothing else changes.
2. Only the four files above changed. Both actions still run: `loadPtoEmployeeDetail`
   returns `days` as a JSON array whose `d` values are 10-character dates and
   `in` values are booleans; `loadPtoBalancesInputs` for year 2026 returns
   `fh_used = 2` for Charles Bush and a new `fh_sheet_used` column.
3. The PTO page still renders exactly as before.
