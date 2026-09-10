# 14 — Process Payroll: pre-fill the next period name and dates

Tim types the period name by hand. Pre-fill it from the last processed
period so the canonical shape and the sequence come for free; he can still
overwrite it.

## Files you may change

- `src/app/lib/periodName.ts` — add one export, source in §1 (verbatim)
- `src/app/pages/ProcessPayroll.tsx` — one `useEffect` (§2), nothing else

**No other file.** Do not change anything else in `ProcessPayroll.tsx` (a
guard counts its `cfgGet` fallbacks; the file is protected — this edit was
requested by Saul on 2026-09-10).

## 1. `periodName.ts` — append verbatim

```ts
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function addDays(ymd: string, n: number): string {
  // Integer date arithmetic on YYYY-MM-DD — no Date object (timezone invariant).
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  let z = era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468 + n;
  z += 719468;
  const era2 = Math.floor(z / 146097);
  const doe = z - era2 * 146097;
  const yoe2 = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy2 = doe - (365 * yoe2 + Math.floor(yoe2 / 4) - Math.floor(yoe2 / 100));
  const mp = Math.floor((5 * doy2 + 2) / 153);
  const dd = doy2 - Math.floor((153 * mp + 2) / 5) + 1;
  const mm = mp < 10 ? mp + 3 : mp - 9;
  const yr = yoe2 + era2 * 400 + (mm <= 2 ? 1 : 0);
  return `${yr}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/**
 * The period that follows `latest`: Q1-Mon → Q2-Mon (same month),
 * Q2-Mon → Q1 of the next month. Dates: the day after the latest end, for
 * fifteen days. Null when the latest name is not canonical or has no end date.
 */
export function nextPeriod(latest: { period_name: string; end_date: string | null }): { name: string; startDate: string; endDate: string } | null {
  const name = normalizePeriodName(latest.period_name);
  const m = /^Q([12])-([A-Z][a-z]{2})-(\d{4})$/.exec(name);
  if (!m || !latest.end_date) return null;
  const half = Number(m[1]);
  let mi = MONTHS.indexOf(m[2]);
  let year = Number(m[3]);
  if (mi < 0) return null;
  let nextHalf = half === 1 ? 2 : 1;
  if (half === 2) { mi = (mi + 1) % 12; if (mi === 0) year += 1; }
  const startDate = addDays(latest.end_date, 1);
  return { name: `Q${nextHalf}-${MONTHS[mi]}-${year}`, startDate, endDate: addDays(startDate, 14) };
}
```

## 2. `ProcessPayroll.tsx`

Right after `existingNames` is built, add:

```ts
  // Pre-fill the next period once the list is known and the form is untouched.
  useEffect(() => {
    if (periodName || startDate || endDate || existingPeriods.length === 0) return;
    const latest = [...existingPeriods]
      .filter(p => !!p.end_date)
      .sort((a, b) => String(b.end_date).localeCompare(String(a.end_date)))[0];
    if (!latest) return;
    const nx = nextPeriod({ period_name: latest.period_name, end_date: String(latest.end_date).slice(0, 10) });
    if (nx) { setPeriodName(nx.name); setStartDate(nx.startDate); setEndDate(nx.endDate); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingPeriods]);
```

Import `nextPeriod` from `@/app/lib/periodName` (extend the existing import
line). `useEffect` is already imported. Nothing else changes.

## Verify

On `/process` with an empty form: the name reads the period after the latest
one (today: `Q1-Sep-2026`, start = the day after the latest end date, end =
start + 14). Typing over it works; the re-run banner and the guard still work.
`tests/periodName.test.ts` P6–P8 pass; L4 unchanged.
