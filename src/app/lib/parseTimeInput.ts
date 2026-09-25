/**
 * Loose time text → "H:MM AM/PM". Used by TimeInput on blur.
 *   "9" → "9:00 AM"   "9p" → "9:00 PM"   "930" → "9:30 AM"   "930p" → "9:30 PM"
 *   "14:30" → "2:30 PM"   "12:35am" → "12:35 AM"   "9:00 AM" → "9:00 AM"
 * Unrecognisable or impossible text ("55:00 PM", "9:75") is returned unchanged;
 * isValidTimeInput tells the UI whether to show it as an error.
 */
export function parseTimeInput(raw: string): string {
  const s = raw.trim();
  if (!s) return '';

  // Already "H:MM AM" shaped, with or without the space, any case.
  const formed = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (formed) {
    const h = Number(formed[1]), m = Number(formed[2]);
    if (h < 1 || h > 12 || m > 59) return s;
    return `${h}:${formed[2]} ${formed[3].toUpperCase()}`;
  }

  const meridiemMatch = s.match(/([AaPp][Mm]?)$/);
  const rawMeridiem = meridiemMatch ? meridiemMatch[1].toLowerCase() : null;
  const isExplicitPm = rawMeridiem === 'pm' || rawMeridiem === 'p';
  const isExplicitAm = rawMeridiem === 'am' || rawMeridiem === 'a';
  const digits = s.replace(/[^0-9]/g, '');

  if (!digits) return s;

  let h: number, m: number;
  if (digits.length <= 2) {
    h = parseInt(digits, 10);
    m = 0;
  } else if (digits.length === 3) {
    h = parseInt(digits.slice(0, 1), 10);
    m = parseInt(digits.slice(1), 10);
  } else {
    h = parseInt(digits.slice(0, 2), 10);
    m = parseInt(digits.slice(2, 4), 10);
  }

  if (isNaN(h) || isNaN(m) || m > 59) return s;
  // With am/pm the hour must be 1–12; without, it is 24-hour (0–23).
  if ((isExplicitAm || isExplicitPm) ? (h < 1 || h > 12) : h > 23) return s;

  let ampm: 'AM' | 'PM';
  if (isExplicitPm) {
    ampm = 'PM';
  } else if (isExplicitAm) {
    ampm = 'AM';
  } else if (h >= 13 && h <= 23) {
    ampm = 'PM';
    h = h - 12;
  } else if (h === 12) {
    ampm = 'PM';
  } else if (h === 0) {
    ampm = 'AM';
    h = 12;
  } else {
    ampm = 'AM';
  }

  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** True when the text is blank or turns into a real "H:MM AM/PM" time. */
export function isValidTimeInput(raw: string): boolean {
  const out = parseTimeInput(raw);
  if (out === '') return true;
  const m = out.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
  return !!m && Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) <= 59;
}
