# 02 — TimeInput: move the parser to a lib file and stop it throwing on "12:35am"

## Files that may change

- `src/app/lib/parseTimeInput.ts` (new)
- `src/app/components/TimeInput.tsx`

No other file may be touched. Do not create, delete, rename or reformat
anything else.

## The bug

`parseTimeInput` in `TimeInput.tsx` matches `12:35am` (no space before am)
with `/^\d{1,2}:\d{2}\s*[AaPp][Mm]$/`, then does `s.split(/\s+/)`, which
yields one element, so `meridiem` is undefined and `meridiem.toUpperCase()`
throws inside `onBlur`. The raw text was already committed by `onChange`, so
the row saves the string exactly as typed. A stored `"12:35am"` exists in
payroll data because of this.

## The change

1. Create `src/app/lib/parseTimeInput.ts` containing exactly this (a pure
   module, no imports, so it can be unit-tested):

```ts
/**
 * Loose time text → "H:MM AM/PM". Used by TimeInput on blur.
 *   "9" → "9:00 AM"   "9p" → "9:00 PM"   "930" → "9:30 AM"   "930p" → "9:30 PM"
 *   "14:30" → "2:30 PM"   "12:35am" → "12:35 AM"   "9:00 AM" → "9:00 AM"
 * Unrecognisable text is returned unchanged.
 */
export function parseTimeInput(raw: string): string {
  const s = raw.trim();
  if (!s) return '';

  // Already "H:MM AM" shaped, with or without the space, any case.
  const formed = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (formed) return `${Number(formed[1])}:${formed[2]} ${formed[3].toUpperCase()}`;

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

  let ampm: 'AM' | 'PM';
  if (isExplicitPm) {
    ampm = 'PM';
  } else if (isExplicitAm) {
    ampm = 'AM';
    if (h === 12) h = 0;
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
```

2. In `src/app/components/TimeInput.tsx`: delete the local `parseTimeInput`
   function and the comment block above it, and add
   `import { parseTimeInput } from '@/app/lib/parseTimeInput';` at the top.
   The `Props` type and the `TimeInput` component body stay exactly as they
   are.

Then confirm every identifier used in each file is imported.
