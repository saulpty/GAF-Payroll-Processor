# AR-3c: stored "0:30 AM" reads as 12:30 AM; time box un-reds itself; Payroll Master dims while refreshing

**Copy every code block exactly, character for character. Do not rewrite, merge, "improve" or re-derive any of it from the description. If your context is compacted mid-task, re-read this prompt before writing any file.**

**Only these three files may change:**

## 1. `src/app/lib/parseTimeInput.ts` (whole file)

Rows edited before today can hold "0:30 AM" (the old parser's output for "1230a"). It is
12:30 AM, the same 30 minutes to the engine, and must not be refused as "not a real time".
Impossible times ("55:00 PM", "13:00 PM", "0:30 PM") are still refused.

```ts
/**
 * Loose time text → "H:MM AM/PM". Used by TimeInput on blur.
 *   "9" → "9:00 AM"   "9p" → "9:00 PM"   "930" → "9:30 AM"   "930p" → "9:30 PM"
 *   "14:30" → "2:30 PM"   "12:35am" → "12:35 AM"   "9:00 AM" → "9:00 AM"
 * Unrecognisable or impossible text ("55:00 PM", "9:75") is returned unchanged;
 * isValidTimeInput tells the UI whether to show it as an error.
 * "0:30 AM" (what this parser wrote for "1230a" before 2026-09-25) reads as "12:30 AM".
 */
export function parseTimeInput(raw: string): string {
  const s = raw.trim();
  if (!s) return '';

  // Already "H:MM AM" shaped, with or without the space, any case.
  const formed = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (formed) {
    let h = Number(formed[1]);
    const m = Number(formed[2]), ap = formed[3].toUpperCase();
    if (h === 0 && ap === 'AM') h = 12;
    if (h < 1 || h > 12 || m > 59) return s;
    return `${h}:${formed[2]} ${ap}`;
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
  if (isExplicitAm && h === 0) h = 12;
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
```

## 2. `src/app/components/TimeInput.tsx` (whole file)

The red "Not a real time" state now clears when the value is replaced from outside
(Discard all, a bulk edit, a reload) and is valid again.

```tsx
import { useEffect, useState } from 'react';
import { parseTimeInput, isValidTimeInput } from '@/app/lib/parseTimeInput';

type Props = {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  /** Called on blur with whether the text is a real time (blank counts as valid). */
  onValidityChange?: (ok: boolean) => void;
};

export function TimeInput({ value, onChange, className = '', placeholder, onValidityChange }: Props) {
  const [bad, setBad] = useState(false);
  // Discard all, a bulk edit or a reload can replace the text from outside: clear the red then.
  useEffect(() => { if (bad && isValidTimeInput(value)) setBad(false); }, [value]);

  const handleBlur = () => {
    const ok = isValidTimeInput(value);
    setBad(!ok);
    onValidityChange?.(ok);
    if (!ok || !value.trim()) return;
    const formatted = parseTimeInput(value);
    if (formatted && formatted !== value) onChange(formatted);
  };

  return (
    <span className="inline-flex flex-col">
      <input
        type="text"
        value={value}
        placeholder={placeholder ?? 'e.g. 9:00 AM'}
        aria-invalid={bad || undefined}
        title={bad ? 'Not a real time' : undefined}
        onChange={e => { if (bad) setBad(false); onChange(e.target.value); }}
        onBlur={handleBlur}
        className={`${className} ${bad ? '!border-red-600 !bg-red-50 !text-red-700 ring-2 ring-red-600/15' : ''}`}
      />
      {bad && <span className="mt-0.5 text-[11px] font-medium text-red-700">Not a real time</span>}
    </span>
  );
}
```

## 3. `src/app/pages/PayrollMaster.tsx`: one line only

The table container line (currently around line 623) reads:
```tsx
          <div className="flex-1 min-h-0 rounded-lg border shadow-sm overflow-auto">
```
Replace that single line with:
```tsx
          <div className={`flex-1 min-h-0 rounded-lg border shadow-sm overflow-auto transition-opacity ${loading ? 'opacity-60 pointer-events-none' : ''}`} aria-busy={loading || undefined}>
```
While a reload runs (after a save, or when the period, tab or page changes) the rows on screen
may belong to the previous view; this dims them and blocks clicks until the fresh rows arrive.
Change nothing else in `PayrollMaster.tsx`.

**No other file may be touched.**

## Report
- Byte size of the three files; the changed PayrollMaster line as it now reads.
- Confirm no other file changed.
