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

/** Inverse of dayNumber (Howard Hinnant's civil_from_days): day count → "YYYY-MM-DD". */
function fromDayNumber(z: number): string {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** The calendar day before a YYYY-MM-DD date ('' when the input is not a date). */
export function dayBefore(ymd: string | null | undefined): string {
  const p = parts(ymd);
  if (!p) return '';
  return fromDayNumber(dayNumber(p[0], p[1], p[2]) - 1);
}

/**
 * The days someone is actually out: first day off → the day before they return.
 * "Mon Aug 17 → Sun Aug 23"; one date when it is a single day or the return is missing/invalid.
 */
export function fmtLeaveDates(leaveOn: string | null | undefined, returnOn: string | null | undefined, thisYear?: string): string {
  const a = String(leaveOn ?? '').slice(0, 10);
  const b = String(returnOn ?? '').slice(0, 10);
  if (!b || b <= a) return fmtDay(a, thisYear);
  return fmtRange(a, dayBefore(b), thisYear);
}
