// What a phone row on Attendance → Today shows. Pure: type-only imports, no clock, no React.
// These are the same rules TodayRow.tsx applies to the table on a computer, kept here so the
// phone rows can be tested without a browser (tests/mobileToday.test.ts).
import type { TodayRow, TodayStatus } from './teramindToday';

export type TodayTone = 'none' | 'yellow' | 'red';

/**
 * The wash behind a phone row, matching the colour of its status pill: red for No Records that
 * nothing explains, yellow for Away. A person on leave (a form or a holiday covers the day) is
 * not flagged, and neither is anyone else.
 */
export function todayTone(status: TodayStatus, onLeave: boolean): TodayTone {
  if (status === 'late_not_in' && !onLeave) return 'red';
  if (status === 'away') return 'yellow';
  return 'none';
}

/** Off today and nothing recorded: the row the table greys out. Worked on a day off: not muted. */
export function isOffToday(row: Pick<TodayRow, 'status' | 'records'>): boolean {
  return row.status === 'day_off' && row.records === 0;
}

export type TodayLate = { minutes: number; level: 'on_time' | 'grace' | 'late' };

/**
 * How late the person came in. null = no entry yet (nothing to say). `grace` = after the shift
 * started but inside the grace period (amber on the table); `late` = after it (red).
 */
export function todayLate(row: Pick<TodayRow, 'entryMin' | 'minutesLate' | 'lateAfterGrace'>): TodayLate | null {
  if (row.entryMin === null) return null;
  if (row.minutesLate === 0) return { minutes: 0, level: 'on_time' };
  return { minutes: row.minutesLate, level: row.lateAfterGrace ? 'late' : 'grace' };
}

/** The nothing-found line: it names every filter that is switched on, in the filter bar's words. */
export function todayNothingFound(f: { employee?: string; manager?: string; role?: string }): string {
  const parts: string[] = [];
  const employee = (f.employee ?? '').trim();
  if (employee) parts.push(`Employee: ${employee}`);
  if (f.manager) parts.push(`Manager: ${f.manager}`);
  if (f.role) parts.push(`Title: ${f.role}`);
  return parts.length ? `No employees match ${parts.join(' · ')}` : 'No employees to show.';
}
