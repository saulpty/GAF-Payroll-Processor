// Turns saved Teramind sessions into the flat {email, timeStarted, timeFinished} rows the
// unchanged payroll file parser expects (sessionsToRawRows), skipping and counting anything
// with no email or a malformed clock string (sessionsToRawRowsReport). foldDays does the same
// entry/exit fold the payroll parser does, but on plain strings, for a comparison screen only
// — payroll itself never calls foldDays.

import type { TeramindSessionRow, TeramindRawRow } from './teramindTypes.ts';

const CLOCK_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

export function sessionsToRawRowsReport(
  rows: TeramindSessionRow[],
): { rows: TeramindRawRow[]; skippedNoEmail: number; skippedBadClock: number } {
  const out: TeramindRawRow[] = [];
  let skippedNoEmail = 0;
  let skippedBadClock = 0;

  for (const r of rows) {
    const email = (r.teramind_email ?? '').trim().toLowerCase();
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    if (!CLOCK_RE.test(r.started_et) || !CLOCK_RE.test(r.finished_et)) {
      skippedBadClock++;
      continue;
    }
    out.push({ email, timeStarted: r.started_et, timeFinished: r.finished_et });
  }

  return { rows: out, skippedNoEmail, skippedBadClock };
}

export function sessionsToRawRows(rows: TeramindSessionRow[]): TeramindRawRow[] {
  return sessionsToRawRowsReport(rows).rows;
}

export function foldDays(rows: TeramindRawRow[]): Map<string, Map<string, { entry: string; exit: string }>> {
  const result = new Map<string, Map<string, { entry: string; exit: string }>>();

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    const day = row.timeStarted.slice(0, 10);
    if (!result.has(email)) result.set(email, new Map());
    const byDay = result.get(email)!;
    const existing = byDay.get(day);
    if (!existing) {
      byDay.set(day, { entry: row.timeStarted, exit: row.timeFinished });
    } else {
      if (row.timeStarted < existing.entry) existing.entry = row.timeStarted;
      if (row.timeFinished > existing.exit) existing.exit = row.timeFinished;
    }
  }

  return result;
}

/**
 * One employee-day as `loadTeramindPunchDays` returns it: the earliest record start and the latest
 * record finish, as plain integers (YYYYMMDD and minutes since midnight, US Eastern). Integers
 * because the database layer rewrites date-looking text on its way to the browser.
 */
export type PunchDay = {
  teramind_email: string;
  first_ymd: number;
  first_min: number;
  last_ymd: number;
  last_min: number;
  ghost_min?: number;
  display_name?: string;
};

function ymdText(n: unknown): string | null {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 19000101 || v > 29991231) return null;
  const y = Math.floor(v / 10000);
  const m = Math.floor(v / 100) % 100;
  const d = v % 100;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function minuteText(n: unknown): string | null {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 0 || v > 1439) return null;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}:00`;
}

/**
 * Saved Teramind days → the rows payroll's file parser would have produced, one per employee-day.
 * Times are cut to the whole minute on purpose: Teramind's export file only ever carried minutes,
 * and payroll's lateness maths must see exactly what it saw with the file. Cut, never rounded: the
 * 12-period comparison against payroll (98.6% of entry times exact) used this same truncation.
 */
export function punchDaysToRawRows(days: PunchDay[]): { rows: TeramindRawRow[]; skipped: number } {
  const rows: TeramindRawRow[] = [];
  let skipped = 0;
  for (const d of days) {
    const email = String(d?.teramind_email ?? '').trim().toLowerCase();
    const fd = ymdText(d?.first_ymd);
    const ft = d?.first_min == null ? null : minuteText(d.first_min);
    const ld = ymdText(d?.last_ymd);
    const lt = d?.last_min == null ? null : minuteText(d.last_min);
    if (!email || !fd || !ft || !ld || !lt || `${ld} ${lt}` < `${fd} ${ft}`) { skipped += 1; continue; }
    rows.push({ email, timeStarted: `${fd} ${ft}`, timeFinished: `${ld} ${lt}` });
  }
  return { rows, skipped };
}
