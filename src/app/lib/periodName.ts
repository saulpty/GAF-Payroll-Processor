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
