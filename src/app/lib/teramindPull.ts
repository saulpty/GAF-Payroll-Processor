// Splits a date range into inclusive chunks of at most `maxDays` for pulling Teramind sessions,
// extending one day past `to` to catch sessions that start after midnight Eastern (and sessions
// that cross midnight at the end of a pay period). Also: detecting a truncated API page,
// computing the rolling "keep fresh" range, and checking whether past pull-log rows already
// cover a date range. All date math is done in whole days via Date.UTC on parsed integers.

import type { PullChunk } from './teramindTypes.ts';

function parseYMD(s: string): [number, number, number] {
  const parts = s.split('-').map((p) => Number.parseInt(p, 10));
  return [parts[0], parts[1], parts[2]];
}

function toDayNumber(s: string): number {
  const [y, m, d] = parseYMD(s);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function fromDayNumber(day: number): string {
  const dt = new Date(day * 86400000);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth() + 1;
  const d = dt.getUTCDate();
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function pullChunks(from: string, to: string, maxDays = 7): PullChunk[] {
  if (from > to) return [];

  const fromDay = toDayNumber(from);
  const toDay = toDayNumber(to) + 1; // catches cross-midnight sessions at the end of the range
  const chunks: PullChunk[] = [];

  let start = fromDay;
  while (start <= toDay) {
    const end = Math.min(start + maxDays - 1, toDay);
    chunks.push({ from: fromDayNumber(start), to: fromDayNumber(end) });
    start = end + 1;
  }

  return chunks;
}

export function isTruncated(rowCount: number, limit: number): boolean {
  return rowCount >= limit;
}

/** Days the keep-fresh sync re-pulls, counting today. A week covers any weekend or holiday
 *  stretch with nobody signed in; the pull is still a single chunk, so it costs one API call. */
export const KEEP_FRESH_DAYS = 7;

export function keepFreshRange(todayEastern: string, days: number = KEEP_FRESH_DAYS): PullChunk {
  const span = Number.isFinite(days) && days >= 1 ? Math.floor(days) : KEEP_FRESH_DAYS;
  const today = toDayNumber(todayEastern);
  return { from: fromDayNumber(today - (span - 1)), to: todayEastern };
}

export function coversRange(
  log: {
    date_from: string; date_to: string; error: string | null; truncated: boolean;
    /** Eastern date the pull ran, from loadTeramindPullLog. */
    pulled_ymd?: string | null;
    /** Timestamp fallback when pulled_ymd is absent; only its first 10 characters are read. */
    pulled_at?: string | null;
  }[],
  from: string,
  to: string,
): boolean {
  if (from > to) return true;

  const covered = new Set<number>();
  for (const entry of log) {
    if (entry.error || entry.truncated) continue;
    const start = toDayNumber(entry.date_from);
    // A pull only ever saw days up to the day it ran; a range reaching into the future
    // (a capture entered before the period ended) covers nothing past that day.
    const ranOn = (entry.pulled_ymd ?? entry.pulled_at ?? '').slice(0, 10);
    const end = /^\d{4}-\d{2}-\d{2}$/.test(ranOn)
      ? Math.min(toDayNumber(entry.date_to), toDayNumber(ranOn))
      : toDayNumber(entry.date_to);
    for (let d = start; d <= end; d++) covered.add(d);
  }

  const fromDay = toDayNumber(from);
  const toDay = toDayNumber(to);
  for (let d = fromDay; d <= toDay; d++) {
    if (!covered.has(d)) return false;
  }

  return true;
}

/**
 * Epoch-second window to ask the Time Records grid for. Deliberately one day wider on each side
 * than the Eastern dates wanted: the rows carry exact instants, so the caller keeps only rows whose
 * Eastern work_date is inside from..to (see `inDateRange`) and no timezone maths is needed here.
 */
export function recordWindow(from: string, to: string): { periodStart: number; periodEnd: number } {
  return {
    periodStart: (toDayNumber(from) - 1) * 86400,
    periodEnd: (toDayNumber(to) + 2) * 86400 - 1,
  };
}

/** Plain string comparison of YYYY-MM-DD dates, inclusive. */
export function inDateRange(workDate: string, from: string, to: string): boolean {
  return workDate >= from && workDate <= to;
}
