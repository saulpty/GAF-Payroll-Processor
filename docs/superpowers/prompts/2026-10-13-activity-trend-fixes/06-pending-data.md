# Activity: pending fixes, part 1 (data) — new hires, long ranges, one-day label, settings file

**Make exactly the edits below, character for character. These are small, targeted edits: do not
rewrite, reformat, reorder or "improve" anything else in any file. If your context is compacted
mid-task, re-read this prompt before writing.**

**Only these files may change.** One new: `src/app/pages/attendance/activity/activitySettings.ts`. Four edited:
`src/app/lib/activityTypes.ts`, `src/app/lib/activityDays.ts`, `src/app/lib/activityTrend.ts`,
`src/app/pages/attendance/activity/useActivityData.ts`. **No other file may be touched.** No migration, no action, no page.

## Why
- `src/AGENTS.md` says "not hired yet → no row", but the day builder never knew the start date, so a new
  hire's scheduled days before they started showed as Needs a Look. It now gets the start date.
- A single-day range read "Oct 7 – Oct 7"; a range over 1000 days returned a mismatched earlier period.
- `useActivityData.ts` was 13.9 KB of the 15 KB cap: its settings parsing moves to its own file, unchanged.

Dates are 'YYYY-MM-DD' strings compared as strings. No `new Date(str)` date maths, no `toISOString()`.

## 1. `src/app/lib/activityTypes.ts`

Edit 1. Replace

```ts
  work_days: string; schedule_start: string; schedule_end: string;
};
```

with

```ts
  work_days: string; schedule_start: string; schedule_end: string;
  start_date?: string | null;   // 'YYYY-MM-DD' or a timestamp; days before it with no work get no row
};
```

## 2. `src/app/lib/activityDays.ts`

Edit 1. Replace

```ts
    const empDays: ActivityDay[] = [];
```

with

```ts
    const empDays: ActivityDay[] = [];
    const startDate = ymd10(emp.start_date);
```

Edit 2. Replace

```ts
      // Not scheduled, nothing happened: no row.
      if (!scheduled && !hasActivity) continue;
```

with

```ts
      // Not scheduled, nothing happened: no row.
      if (!scheduled && !hasActivity) continue;
      // Not hired yet, nothing happened: no row either (and so never Needs A Look).
      if (startDate !== '' && cur < startDate && !hasActivity) continue;
```

## 3. `src/app/lib/activityTrend.ts`

Edit 1. Replace

```ts
  let days = 1;
  for (let cur = dateFrom; cur < dateTo && days < 1000; cur = step(cur, 1)) days += 1;
  return { from: subDays(dateFrom, days), to: subDays(dateFrom, 1), days };
```

with

```ts
  let days = 1, cur = dateFrom;
  for (; cur < dateTo && days < 1000; cur = step(cur, 1)) days += 1;
  // Longer than the 1000-day cap: no comparison, never a mismatched earlier period.
  if (cur < dateTo) return { from: dateFrom, to: dateFrom, days: 0 };
  return { from: subDays(dateFrom, days), to: subDays(dateFrom, 1), days };
```

Edit 2. Replace

```ts
  if (!YMD.test(from) || !YMD.test(to)) return '';
  const years
```

with

```ts
  if (!YMD.test(from) || !YMD.test(to)) return '';
  if (from === to) return part(from, false);
  const years
```

Edit 3. Replace

```ts
/** 'Sep 5 – Sep 23'; years are added only when the two ends are in different years. */
```

with

```ts
/** 'Sep 5 – Sep 23', or 'Oct 7' for a single day; years are added only when the two ends are in different years. */
```

Then three more edits in the same file (labels in Title Case, and a shorter one that fits its column):

Edit 4. Replace

```ts
  improved: 'Improved', worse: 'Worse', mixed: 'Mixed', steady: 'Steady', nodata: 'Not enough data',
```

with

```ts
  improved: 'Improved', worse: 'Worse', mixed: 'Mixed', steady: 'Steady', nodata: 'Not Enough Data',
```

Edit 5. Replace

```ts
/** The Change cell: '+1h 11m', '12m earlier', '5 fewer', or 'About the same' under the minimum. */
```

with

```ts
/** The Change cell: '+1h 11m', '12m earlier', '5 fewer', or 'No Change' under the minimum. */
```

Edit 6. Replace

```ts
  if (c.tone === '') return 'About the same';
```

with

```ts
  if (c.tone === '') return 'No Change';
```

## 4. New file `src/app/pages/attendance/activity/activitySettings.ts` — the whole file

```ts
// Activity settings read from classification_config (category 'teramind'): the day thresholds and
// the trend minimums. Split out of useActivityData.ts on 2026-10-13 to keep that file under 15 KB.
import type { ActivitySettings } from '@/app/lib/activityDays';
import type { TrendMinimums } from '@/app/lib/activityTrend';
import { DEFAULT_TREND_MINIMUMS } from '@/app/lib/activityTrend';

export type ConfigRow = { key: string; value: string; label: string; description: string; category: string };

const FALLBACK_MIN_ACTIVE = 390;
const FALLBACK_BREAK = 60;
const FALLBACK_BREAK_OVER = 30;

export function parseSettings(rows: ConfigRow[]): { settings: ActivitySettings; fallbacks: string[] } {
  const teramind = rows.filter(r => r.category === 'teramind');
  const pick = (key: string) => teramind.find(r => r.key === key)?.value;
  const fallbacks: string[] = [];

  const minActive = Number(pick('activity_min_active_minutes'));
  const breakMin = Number(pick('activity_break_minutes'));
  const breakOver = Number(pick('activity_break_over_minutes'));

  if (!Number.isFinite(minActive) || minActive <= 0) fallbacks.push('activity_min_active_minutes');
  if (!Number.isFinite(breakMin)  || breakMin <= 0)  fallbacks.push('activity_break_minutes');
  if (!Number.isFinite(breakOver) || breakOver <= 0) fallbacks.push('activity_break_over_minutes');

  return {
    settings: {
      minActiveMinutes: (Number.isFinite(minActive) && minActive > 0) ? minActive : FALLBACK_MIN_ACTIVE,
      breakMinutes:     (Number.isFinite(breakMin)  && breakMin > 0)  ? breakMin  : FALLBACK_BREAK,
      breakOverMinutes: (Number.isFinite(breakOver) && breakOver > 0) ? breakOver : FALLBACK_BREAK_OVER,
    },
    fallbacks,
  };
}

const TREND_KEYS: [keyof TrendMinimums, string][] = [
  ['activeMinutes', 'activity_trend_min_active_minutes'],
  ['entryMinutes', 'activity_trend_min_entry_minutes'],
  ['days', 'activity_trend_min_days'],
  ['workedDays', 'activity_trend_min_worked_days'],
];

export function parseMinimums(rows: ConfigRow[]): { minimums: TrendMinimums; fallbacks: string[] } {
  const minimums: TrendMinimums = { ...DEFAULT_TREND_MINIMUMS };
  const fallbacks: string[] = [];
  for (const [field, key] of TREND_KEYS) {
    const n = Number(rows.find(r => r.category === 'teramind' && r.key === key)?.value);
    if (Number.isFinite(n) && n > 0) minimums[field] = n; else fallbacks.push(key);
  }
  return { minimums, fallbacks };
}
```

## 5. `src/app/pages/attendance/activity/useActivityData.ts`

Edit 1. Delete this line (it now lives in `activitySettings.ts`):

```ts
type ConfigRow = { key: string; value: string; label: string; description: string; category: string };
```

Edit 2. Delete this whole block, from `const FALLBACK_MIN_ACTIVE = 390;` through the closing `}` of `parseMinimums` (it now lives in `activitySettings.ts`). Keep `inRange` and `NO_PREV`, which follow it:

```ts
const FALLBACK_MIN_ACTIVE = 390;
const FALLBACK_BREAK = 60;
const FALLBACK_BREAK_OVER = 30;

function parseSettings(rows: ConfigRow[]): { settings: ActivitySettings; fallbacks: string[] } {
  const teramind = rows.filter(r => r.category === 'teramind');
  const pick = (key: string) => teramind.find(r => r.key === key)?.value;
  const fallbacks: string[] = [];

  const minActive = Number(pick('activity_min_active_minutes'));
  const breakMin = Number(pick('activity_break_minutes'));
  const breakOver = Number(pick('activity_break_over_minutes'));

  if (!Number.isFinite(minActive) || minActive <= 0) fallbacks.push('activity_min_active_minutes');
  if (!Number.isFinite(breakMin)  || breakMin <= 0)  fallbacks.push('activity_break_minutes');
  if (!Number.isFinite(breakOver) || breakOver <= 0) fallbacks.push('activity_break_over_minutes');

  return {
    settings: {
      minActiveMinutes: (Number.isFinite(minActive) && minActive > 0) ? minActive : FALLBACK_MIN_ACTIVE,
      breakMinutes:     (Number.isFinite(breakMin)  && breakMin > 0)  ? breakMin  : FALLBACK_BREAK,
      breakOverMinutes: (Number.isFinite(breakOver) && breakOver > 0) ? breakOver : FALLBACK_BREAK_OVER,
    },
    fallbacks,
  };
}

const TREND_KEYS: [keyof TrendMinimums, string][] = [
  ['activeMinutes', 'activity_trend_min_active_minutes'],
  ['entryMinutes', 'activity_trend_min_entry_minutes'],
  ['days', 'activity_trend_min_days'],
  ['workedDays', 'activity_trend_min_worked_days'],
];

function parseMinimums(rows: ConfigRow[]): { minimums: TrendMinimums; fallbacks: string[] } {
  const minimums: TrendMinimums = { ...DEFAULT_TREND_MINIMUMS };
  const fallbacks: string[] = [];
  for (const [field, key] of TREND_KEYS) {
    const n = Number(rows.find(r => r.category === 'teramind' && r.key === key)?.value);
    if (Number.isFinite(n) && n > 0) minimums[field] = n; else fallbacks.push(key);
  }
  return { minimums, fallbacks };
}
```

Edit 3. After the line `import type { EmployeeTrend, TrendMinimums, TotalsChange } from '@/app/lib/activityTrend';` add:

```ts
import { parseSettings, parseMinimums } from './activitySettings';
import type { ConfigRow } from './activitySettings';
```

Edit 4. Replace

```ts
      schedule_start: e.standard_start,
      schedule_end: e.standard_end,
    }));
```

with

```ts
      schedule_start: e.standard_start,
      schedule_end: e.standard_end,
      start_date: e.start_date,
    }));
```

## Acceptance
Attendance → Activity: an employee who started inside the selected dates no longer shows Needs a Look for the days before they started. Everything else is unchanged.

When done, reply with a one-line summary per file.
