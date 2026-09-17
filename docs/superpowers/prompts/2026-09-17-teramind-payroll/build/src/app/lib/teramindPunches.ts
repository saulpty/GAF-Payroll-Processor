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
