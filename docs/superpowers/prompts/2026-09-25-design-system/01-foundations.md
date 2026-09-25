# Design system 01: Warm tokens, animations, time/shift formatter, real-times-only time box

Read `src/DESIGN.md` first. **Only these five files may change:**
1. `src/index.css`: append the block in section A. Change nothing already there.
2. `src/tailwind.config.js`: add the keys in section B inside `theme.extend`. Change nothing already there.
3. **New** `src/app/lib/fmtTime.ts`: exactly the code in section C.
4. `src/app/lib/parseTimeInput.ts`: replace the whole file with section D.
5. `src/app/components/TimeInput.tsx`: replace the whole file with section E.

No other file may be touched. In particular: do **not** change `--primary`, `--secondary` or any
existing token, do not restyle any page, do not edit `src/components/ui/*`,
`classificationEngine.ts` or `punchMinutes.ts`. No page uses the Warm tokens yet; they are for
redesigned pages only (page-by-page rollout).

Copy sections C, D and E **exactly**. They were tested outside the app (`tests/fmtTime.test.ts`,
`tests/parseTimeInput.test.ts`); any "improvement" breaks those tests.

## A. `src/index.css`, append at the end

```css
/* Warm variant tokens (design system, 2026-09-25). Used ONLY by redesigned pages.
   Orange fills carry --warm-ink text: white on #F37021 fails contrast. */
:root {
  --warm: #F37021;
  --warm-ink: #08193E;
  --warm-text: #C2410C;
  --warm-tint: #FFF4EC;
  --warm-ring: rgb(243 112 33 / 0.25);
}

@media (prefers-reduced-motion: reduce) {
  .animate-flash-required, .animate-saved-fade { animation: none !important; }
}
```

## B. `src/tailwind.config.js`, add inside `theme.extend`

Add to `colors` (next to `status-red`):
```js
warm: { DEFAULT: 'var(--warm)', ink: 'var(--warm-ink)', text: 'var(--warm-text)', tint: 'var(--warm-tint)', ring: 'var(--warm-ring)' },
```
Add to `keyframes`:
```js
'flash-required': {
  '0%, 50%, 100%': { boxShadow: '0 0 0 0 rgb(220 38 38 / 0)', borderColor: 'rgb(203 213 225)' },
  '25%, 75%': { boxShadow: '0 0 0 3px rgb(220 38 38 / 0.35)', borderColor: 'rgb(220 38 38)' },
},
'saved-fade': {
  from: { backgroundColor: 'var(--status-green-tint)' },
  to: { backgroundColor: 'transparent' },
},
```
Add to `animation`:
```js
'flash-required': 'flash-required 600ms ease-in-out',
'saved-fade': 'saved-fade 1200ms ease-out',
```

## C. New `src/app/lib/fmtTime.ts`

```ts
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
```

## D. `src/app/lib/parseTimeInput.ts` (whole file)

What changes: impossible times (`55:00 PM`, `13:00 PM`, `9:75`) are no longer turned into a
"time"; they come back as typed, and the new `isValidTimeInput` reports them. `1230a` now gives
`12:30 AM` instead of `0:30 AM` (same minutes to the engine, which reads 12 AM as 0).

```ts
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
```

## E. `src/app/components/TimeInput.tsx` (whole file)

Same props as before plus an optional `onValidityChange`. On blur, an impossible time turns the
box red and shows `Not a real time` under it; typing clears the red. Callers
(`ActionRequired.tsx`, `PayrollMaster.tsx`, `AdminSchedules.tsx`) must **not** be edited: they keep
working unchanged.

```tsx
import { useState } from 'react';
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

## Report
- Byte size of each of the five files.
- Confirm `ActionRequired.tsx`, `PayrollMaster.tsx`, `AdminSchedules.tsx`, `classificationEngine.ts`
  and `punchMinutes.ts` are unchanged.
