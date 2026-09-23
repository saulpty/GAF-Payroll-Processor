# 01 — Let Q2 follow Q1, and add "period name from end date"

**Only this one file may change. No other file may be touched.**

- `src/app/lib/periodName.ts`

Do not create files. Do not touch any page, action, migration or other lib. Do not reformat
anything you are not asked to change. Do not rename or remove any existing export.

## The bug (reproduced 2026-09-23)

`nearMatch` is the typo guard Process Payroll runs before a payroll run. It treats any name one
edit away from an existing period as a typo. But two correctly-shaped period names one character
apart are two *different* periods:

```
nearMatch('Q2-Sep-2026', ['Q1-Sep-2026'])  →  'Q1-Sep-2026'   (should be null)
nearMatch('Q1-Jul-2026', ['Q1-Jun-2026'])  →  'Q1-Jun-2026'   (should be null)
nearMatch('Q1-May-2026', ['Q1-Mar-2026'])  →  'Q1-Mar-2026'   (should be null)
nearMatch('Q1-Jan-2027', ['Q1-Jan-2026'])  →  'Q1-Jan-2026'   (should be null)
```

So Process Payroll refuses to create Q2-Sep-2026, which is due on Sep 25. The only thing a
malformed name can be is a typo of a well-formed one (the original incident was `Q1-Aug-20260`).

## 1. `nearMatch` — two canonical names are never near each other

In `nearMatch`, right after the loop that returns `null` on an exact match, add:

```ts
  // Two names with the canonical shape are two different periods — Q2-Sep is not a
  // typo of Q1-Sep, nor Jul of Jun, nor 2027 of 2026. Only malformed input can be a typo.
  const typedIsCanonical = CANON.test(name);
```

and inside the ranking loop, immediately after `if (!k) continue;`, add:

```ts
    if (typedIsCanonical && CANON.test(en)) continue;
```

Nothing else in `nearMatch` changes. Malformed input (`Q1-Aug-20260`, `q2-sep-2026`,
`Q1 Aug 2026`) must still be matched to the canonical period exactly as today.

## 2. New export `periodNameFromEndDate`

Add this function at the end of the file:

```ts
/**
 * The period name for a pay period, taken from its END date: a period ending on
 * day 1–15 is Q1 of that month, one ending on day 16 or later is Q2. The start
 * date can fall in the previous month (Q1-Apr-2026 ran Mar 26 → Apr 10), so it
 * is not used. Null when the end date is missing or not YYYY-MM-DD.
 * String arithmetic only — no Date object (timezone invariant).
 */
export function periodNameFromEndDate(endDate: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(endDate ?? '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `Q${day <= 15 ? 1 : 2}-${MONTHS[month - 1]}-${year}`;
}
```

It uses the existing `MONTHS` array in this file. Do not use `new Date(...)`, `Date.parse`,
`toISOString` or any other Date method — dates in this app are `YYYY-MM-DD` strings and are
handled as strings.

## Acceptance

- `nearMatch('Q2-Sep-2026', ['Q1-Sep-2026'])` returns `null`.
- `nearMatch('Q1-Aug-20260', ['Q1-Aug-2026'])` still returns `'Q1-Aug-2026'`.
- `periodNameFromEndDate('2026-09-25')` returns `'Q2-Sep-2026'`;
  `periodNameFromEndDate('2026-09-08')` returns `'Q1-Sep-2026'`;
  `periodNameFromEndDate('2027-01-09')` returns `'Q1-Jan-2027'`;
  `periodNameFromEndDate('')` returns `null`.
- `src/app/lib/periodName.ts` is the only file changed.
