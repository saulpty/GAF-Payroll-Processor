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
