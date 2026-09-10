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

const WD_LONG  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MON_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/** "Thursday, September 8, 2026". Accepts a YYYY-MM-DD string or a Postgres timestamp string. */
export function fmtDayLong(ymd: string | null | undefined): string {
  if (!ymd) return '';
  const p = parts(ymd);
  if (!p) return String(ymd);
  return `${WD_LONG[weekday(ymd)]}, ${MON_LONG[p[1] - 1]} ${p[2]}, ${p[0]}`;
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
