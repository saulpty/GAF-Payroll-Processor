// Periods picker for Attendance List / Reports: every named period, plus placeholder
// periods that Process Payroll has not run yet, up to the one containing today.
// NO RUNTIME IMPORTS (node --test, see reportKpis.ts): nextPeriod from periodName.ts is
// injected. Dates are 'YYYY-MM-DD' strings compared as strings; no Date objects.

export type PeriodSourceRow = {
  period_name: string; start_date: string | null; end_date: string | null;
  processed_at: string | null;
};

export type PeriodOption = {
  period_name: string; start_date: string; end_date: string; processed: boolean;
};

/** periodName.nextPeriod's real signature. */
export type NextPeriodFn = (latest: { period_name: string; end_date: string | null }) =>
  { name: string; startDate: string; endDate: string } | null;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const ymd10 = (v: unknown): string => (v == null ? '' : String(v).slice(0, 10));

export function attendancePeriodOptions(
  rows: PeriodSourceRow[], today: string, nextPeriod: NextPeriodFn,
): {
  options: PeriodOption[];
  defaultName: string | null;
  rangeOf(names: string[]): { from: string; to: string } | null;
} {
  const t = ymd10(today);
  const byName = new Map<string, PeriodOption>();
  for (const r of rows ?? []) {
    const name = String(r?.period_name ?? '').trim();
    if (!name) continue;
    const opt: PeriodOption = {
      period_name: name, start_date: ymd10(r.start_date), end_date: ymd10(r.end_date),
      processed: !!r.processed_at,
    };
    const had = byName.get(name);
    if (!had || (opt.processed && !had.processed)) byName.set(name, opt);
  }

  // Placeholders after the newest processed period, while they start on or before today.
  let newest: PeriodOption | null = null;
  for (const o of byName.values()) {
    if (o.processed && YMD.test(o.end_date) && (!newest || o.end_date > newest.end_date)) newest = o;
  }
  if (newest && YMD.test(t)) {
    let cur = { period_name: newest.period_name, end_date: newest.end_date as string | null };
    for (let i = 0; i < 60; i++) {            // safety cap: ~2.5 years of periods
      const nx = nextPeriod(cur);
      if (!nx || !YMD.test(nx.startDate) || nx.startDate > t) break;
      if (!byName.has(nx.name)) {
        byName.set(nx.name, { period_name: nx.name, start_date: nx.startDate, end_date: nx.endDate, processed: false });
      }
      cur = { period_name: nx.name, end_date: nx.endDate };
    }
  }

  const options = [...byName.values()].sort((a, b) => {
    const ka = a.start_date || a.end_date, kb = b.start_date || b.end_date;
    if (ka !== kb) return ka < kb ? 1 : -1;
    return a.period_name < b.period_name ? 1 : a.period_name > b.period_name ? -1 : 0;
  });

  const containing = options.find((o) => o.start_date !== '' && o.start_date <= t && t <= o.end_date);
  const defaultName = containing ? containing.period_name : newest ? newest.period_name : null;

  function rangeOf(names: string[]): { from: string; to: string } | null {
    const pick = new Set((names ?? []).map((n) => String(n).trim()));
    let from = '', to = '';
    for (const o of options) {
      if (!pick.has(o.period_name) || !YMD.test(o.start_date) || !YMD.test(o.end_date)) continue;
      if (from === '' || o.start_date < from) from = o.start_date;
      if (to === '' || o.end_date > to) to = o.end_date;
    }
    if (from === '') return null;
    if (YMD.test(t) && to > t) to = t;
    return from <= to ? { from, to } : null;
  }

  return { options, defaultName, rangeOf };
}
