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

export function keepFreshRange(todayEastern: string): PullChunk {
  const today = toDayNumber(todayEastern);
  return { from: fromDayNumber(today - 1), to: todayEastern };
}

export function coversRange(
  log: { date_from: string; date_to: string; error: string | null; truncated: boolean }[],
  from: string,
  to: string,
): boolean {
  if (from > to) return true;

  const covered = new Set<number>();
  for (const entry of log) {
    if (entry.error || entry.truncated) continue;
    const start = toDayNumber(entry.date_from);
    const end = toDayNumber(entry.date_to);
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
