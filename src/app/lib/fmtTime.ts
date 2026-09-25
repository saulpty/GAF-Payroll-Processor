/**
 * Display formatters for times and shifts (design system, 2026-09-25).
 * Pure string work: no Date, so no timezone can leak in.
 *   fmtTime('9:00 AM') → '9AM'    fmtTime('9:30 AM') → '9:30AM'    fmtTime('14:30') → '2:30PM'
 *   fmtWorkDays('Mon,Tue,Wed,Thu,Fri') → 'Mon–Fri'    'Thu,Fri,Sat,Sun,Mon' → 'Thu–Mon'
 *   fmtShift('Mon,Tue,Wed,Thu,Fri', '9:00 AM', '5:00 PM') → 'Mon–Fri · 9AM–5PM'
 * Anything unrecognisable is returned trimmed and unchanged.
 */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function fmtTime(t: string | null | undefined): string {
  const s = (t ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!m) return s;
  let h = Number(m[1]);
  const mm = m[2];
  if (Number(mm) > 59) return s;
  let ap: string;
  if (m[3]) {
    if (h < 0 || h > 12) return s;
    ap = m[3].toUpperCase();
    if (h === 0) h = 12;
  } else {
    if (h > 23) return s;
    ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 === 0 ? 12 : h % 12;
  }
  return `${h}${mm === '00' ? '' : ':' + mm}${ap}`;
}

export function fmtWorkDays(csv: string | null | undefined): string {
  const set = new Set(
    (csv ?? '').split(',').map(d => d.trim().slice(0, 3).toLowerCase()).filter(Boolean),
  );
  const on = DAYS.map(d => set.has(d.toLowerCase()));
  const n = on.filter(Boolean).length;
  if (n === 0) return '';
  if (n === 7) return 'Every day';
  const starts = on.map((v, i) => v && !on[(i + 6) % 7]).map((v, i) => (v ? i : -1)).filter(i => i >= 0);
  if (starts.length === 1 && n >= 3) {
    const a = starts[0];
    return `${DAYS[a]}–${DAYS[(a + n - 1) % 7]}`;
  }
  return DAYS.filter((_, i) => on[i]).join(', ');
}

export function fmtShift(workDays: string | null | undefined, start: string | null | undefined, end: string | null | undefined): string {
  const days = fmtWorkDays(workDays);
  const a = fmtTime(start), b = fmtTime(end);
  const hours = a && b ? `${a}–${b}` : a || b;
  return [days, hours].filter(Boolean).join(' · ');
}
