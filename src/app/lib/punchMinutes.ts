// No imports on purpose: node --test cannot resolve an extension-less './classificationEngine',
// and this file must stay unit-testable. toMinutes is the engine's parseTimeToMinutes regex.

/** "8:07 AM" → minutes since midnight. Blank or unparseable → 0. */
function toMinutes(t: string): number {
  const m = (t || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + parseInt(m[2], 10);
}

export type PunchInput = {
  entry_time: string | null | undefined;
  exit_time: string | null | undefined;
  scheduled_start: string;
  scheduled_end: string;
  grace_until: string | null | undefined;
};

export type PunchMinutes = {
  late_minutes: number;
  late_after_grace: number;
  early_leave_minutes: number;
  /** exit is earlier than entry — the session ran past midnight; early leave is not assessed */
  crossed_midnight: boolean;
};

/** Strict stored shape: "9:05 AM". Anything else is not a time and must not be saved. */
export const STRICT_TIME = /^\d{1,2}:\d{2} (AM|PM)$/;

/** True when the value is blank or a strict "H:MM AM" time. */
export function isStoredTime(t: string | null | undefined): boolean {
  const s = (t || '').trim();
  return s === '' || STRICT_TIME.test(s);
}

/**
 * Minutes late / early for a row from its own punches and schedule strings.
 * Same arithmetic as runClassificationEngine:
 *   late_minutes        = max(0, entry − scheduled_start)
 *   late_after_grace    = max(0, late_minutes − grace)   grace = grace_until − scheduled_start
 *   early_leave_minutes = max(0, scheduled_end − exit)
 * Rules for the edit path (decided 2026-09-11):
 *   blank entry → late 0; blank exit → early 0 (nothing to measure);
 *   exit earlier than entry → early 0 and crossed_midnight true;
 *   a non-blank value that is not "H:MM AM" → null (caller refuses to save).
 */
export function computePunchMinutes(p: PunchInput): PunchMinutes | null {
  const entry = (p.entry_time || '').trim();
  const exit = (p.exit_time || '').trim();
  if (!isStoredTime(entry) || !isStoredTime(exit)) return null;

  const start = toMinutes(p.scheduled_start);
  const end = toMinutes(p.scheduled_end);
  const grace = p.grace_until ? (toMinutes(p.grace_until) - start + 1440) % 1440 : 0;

  const entryMins = entry ? toMinutes(entry) : null;
  const exitMins = exit ? toMinutes(exit) : null;

  const late_minutes = entryMins === null ? 0 : Math.max(0, entryMins - start);
  const late_after_grace = Math.max(0, late_minutes - grace);
  const crossed_midnight = entryMins !== null && exitMins !== null && exitMins < entryMins;
  const early_leave_minutes = exitMins === null || crossed_midnight ? 0 : Math.max(0, end - exitMins);

  return { late_minutes, late_after_grace, early_leave_minutes, crossed_midnight };
}
