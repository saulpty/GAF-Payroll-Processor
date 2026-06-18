/**
 * TimeInput – smart time auto-formatter.
 *
 * Accepts loose typing and formats on blur to "H:MM AM/PM".
 * Examples:
 *   "9"      → "9:00 AM"
 *   "9a"     → "9:00 AM"
 *   "9p"     → "9:00 PM"
 *   "930"    → "9:30 AM"
 *   "930p"   → "9:30 PM"
 *   "9:30"   → "9:30 AM"
 *   "14"     → "2:00 PM"
 *   "14:30"  → "2:30 PM"
 *   "9:00 AM"→ "9:00 AM" (unchanged)
 */

type Props = {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
};

function parseTimeInput(raw: string): string {
  const s = raw.trim();
  if (!s) return '';

  // Already formatted correctly – pass through
  if (/^\d{1,2}:\d{2}\s*[AaPp][Mm]$/.test(s)) {
    const [time, meridiem] = s.split(/\s+/);
    const [h, m] = time.split(':').map(Number);
    return `${h}:${String(m).padStart(2, '0')} ${meridiem.toUpperCase()}`;
  }

  // Detect explicit AM/PM suffix
  const meridiemMatch = s.match(/([AaPp][Mm]?)$/);
  const rawMeridiem = meridiemMatch ? meridiemMatch[1].toLowerCase() : null;
  const isExplicitPm = rawMeridiem === 'pm' || rawMeridiem === 'p';
  const isExplicitAm = rawMeridiem === 'am' || rawMeridiem === 'a';
  const digits = s.replace(/[^0-9]/g, '');

  if (!digits) return s; // unrecognisable – return as-is

  let h: number, m: number;

  if (digits.length <= 2) {
    // "9" or "14"
    h = parseInt(digits, 10);
    m = 0;
  } else if (digits.length === 3) {
    // "930"
    h = parseInt(digits.slice(0, 1), 10);
    m = parseInt(digits.slice(1), 10);
  } else {
    // "1030" or "930" with leading zero
    h = parseInt(digits.slice(0, 2), 10);
    m = parseInt(digits.slice(2, 4), 10);
  }

  if (isNaN(h) || isNaN(m) || m > 59) return s;

  // Determine AM/PM
  let ampm: 'AM' | 'PM';
  if (isExplicitPm) {
    ampm = 'PM';
    if (h < 12) h = h; // keep as-is, already pm
  } else if (isExplicitAm) {
    ampm = 'AM';
    if (h === 12) h = 0;
  } else if (h >= 13 && h <= 23) {
    // 24h format
    ampm = 'PM';
    h = h - 12;
  } else if (h === 12) {
    ampm = 'PM';
  } else if (h === 0) {
    ampm = 'AM';
    h = 12;
  } else {
    // Ambiguous — default AM for morning hours, PM for ≥1 when typed with p
    ampm = 'AM';
  }

  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function TimeInput({ value, onChange, className = '', placeholder }: Props) {
  const handleBlur = () => {
    if (!value.trim()) return;
    const formatted = parseTimeInput(value);
    if (formatted && formatted !== value) onChange(formatted);
  };

  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder ?? 'e.g. 9:00 AM'}
      onChange={e => onChange(e.target.value)}
      onBlur={handleBlur}
      className={className}
    />
  );
}
