# Create `src/app/lib/tenure.ts` — pure date maths for the Contracts page

**Create exactly one new file: `src/app/lib/tenure.ts`.**
**No other file may be created, modified or deleted.** Do not touch any page, any
action, `app.tsx`, `TopNav.tsx`, or any existing file in `src/app/lib/`. Do not
write a migration. This is a self-contained module; nothing imports it yet, and
that is expected.

## The timezone invariant — read this before writing a line

From `src/AGENTS.md`, and the reason this codebase carries roughly ten
successive migrations all fixing the same bug:

- Dates are `'YYYY-MM-DD'` **strings**. Compare them as strings.
- **Never call `new Date(someDateString)`.** Parsing `'2026-09-02'` yields UTC
  midnight, which is the previous calendar day in Panama (UTC-5).
- Never call `Date.now()` or `new Date()` in this module. "Today" is always
  passed in as an `asOf` parameter.
- Postgres sometimes returns a full timestamp, so **slice every input to 10
  characters** before using it.

`src/app/lib/ptoAccrual.ts` is the model to follow — same style, same purity, no
imports. Copy its day-number idiom exactly:

```ts
function toDayNumber(d: string): number {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, day) / 86400000);
}
```

`Date.UTC` takes numbers, so it is safe. That is the **only** permitted use of
`Date` in this file.

## The module must export exactly these six functions

```ts
export function addMonths(start: string, months: number): string;
export function milestones(start: string): { key: string; date: string }[];
export function tenureLabel(start: string, asOf: string): string;
export function daysUntil(from: string, to: string): number;
export function nextMilestone(start: string, asOf: string):
  { key: string; date: string; days: number } | null;
export function contractEndState(end: string | null, asOf: string):
  { kind: 'none' | 'ended' | 'future'; days: number | null };
```

### `addMonths(start, months)`

Adds calendar months. **If the target day does not exist, clamp to the last day
of the target month.** Do the arithmetic on the year/month/day numbers; do not
construct a Date.

| Call | Result | Why |
|---|---|---|
| `addMonths('2026-01-31', 1)` | `'2026-02-28'` | no 31st in February |
| `addMonths('2028-01-31', 1)` | `'2028-02-29'` | 2028 is a leap year |
| `addMonths('2026-03-31', 1)` | `'2026-04-30'` | April has 30 days |
| `addMonths('2026-08-31', 6)` | `'2027-02-28'` | clamps and rolls the year |
| `addMonths('2026-03-02', 6)` | `'2026-09-02'` | ordinary case |
| `addMonths('2026-03-02', 24)` | `'2028-03-02'` | two years |
| `addMonths('2025-11-19', 12)` | `'2026-11-19'` | one year |

Output is always zero-padded `YYYY-MM-DD`.

### `milestones(start)`

Returns exactly five entries, in this order, using `addMonths`:

```
[{ key: '1m', date: … }, { key: '3m', … }, { key: '6m', … },
 { key: '1y', … }, { key: '2y', … }]
```

with offsets 1, 3, 6, 12 and 24 months.

`milestones('2026-03-02')` must be `2026-04-02`, `2026-06-02`, `2026-09-02`,
`2027-03-02`, `2028-03-02`.

### `tenureLabel(start, asOf)`

Whole years and months elapsed, same calendar logic.

- 12 months or more, with leftover months: `'1y 5m'`
- a whole number of years: `'1y'`, `'2y'` — never `'1y 0m'`
- under a year: `'9m'`, `'5m'`
- under one month, or the same day: `'new'`

A month only counts once the day-of-month is reached. Worked example: someone
who started `2026-03-02` is `'5m'` on `2026-09-01` and `'6m'` on `2026-09-02`.

Checks: `tenureLabel('2025-11-19', '2026-09-01')` → `'9m'`.
`tenureLabel('2026-03-02', '2026-09-01')` → `'5m'`.
`tenureLabel('2025-03-12', '2026-09-01')` → `'1y 5m'`.
`tenureLabel('2025-09-01', '2026-09-01')` → `'1y'`.
`tenureLabel('2026-08-20', '2026-09-01')` → `'new'`.

### `daysUntil(from, to)`

Plain calendar days, `to` minus `from`. Positive for the future, negative for
the past, `0` on the same day. Use the `toDayNumber` idiom — subtracting two
day numbers is exact.

These are real values from the live database on `from = '2026-09-01'` and must
come out exactly:

| `to` | result |
|---|---|
| `2026-09-02` | `1` |
| `2026-12-08` | `98` |
| `2026-12-15` | `105` |
| `2027-01-06` | `127` |
| `2027-01-20` | `141` |
| `2027-02-03` | `155` |
| `2026-08-24` | `-8` |
| `2026-08-02` | `-30` |
| `2026-05-19` | `-105` |

`2027-01-20` crosses the 1 November 2026 US daylight-saving change. A
local-time subtraction produces `140.958…` and floors to `140`. That is the bug
this idiom exists to prevent.

### `nextMilestone(start, asOf)`

The first milestone whose date is **not before** `asOf` — so a milestone falling
today still counts as next — with its `days` from `daysUntil(asOf, date)`.
Returns `null` when all five have passed.

- `nextMilestone('2026-03-02', '2026-09-01')` → `{ key: '6m', date: '2026-09-02', days: 1 }`
- `nextMilestone('2025-11-19', '2026-09-01')` → `{ key: '1y', date: '2026-11-19', days: 79 }`
- `nextMilestone('2020-01-01', '2026-09-01')` → `null`

### `contractEndState(end, asOf)`

| Input | Result |
|---|---|
| `null` or `''` | `{ kind: 'none', days: null }` |
| a date before `asOf` | `{ kind: 'ended', days: <negative> }` |
| `asOf` itself, or later | `{ kind: 'future', days: >= 0 }` |

- `contractEndState(null, '2026-09-01')` → `{ kind: 'none', days: null }`
- `contractEndState('2026-05-19', '2026-09-01')` → `{ kind: 'ended', days: -105 }`
- `contractEndState('2026-09-02', '2026-09-01')` → `{ kind: 'future', days: 1 }`
- `contractEndState('2026-09-01', '2026-09-01')` → `{ kind: 'future', days: 0 }`
- `contractEndState('2026-09-02T00:00:00.000Z', '2026-09-01')` →
  `{ kind: 'future', days: 1 }` — the timestamp is sliced, never parsed

**Why `ended` is not a warning:** 31 of 44 employees have a contract end date in
the past. That is the normal state — people finish a six-month contract and move
to an indefinite one without the board being updated. The page renders `ended`
muted. Do not invent an `expired` or `overdue` kind.

## Constraints

- **No imports.** The file must stand alone, exactly like `ptoAccrual.ts`.
- No React, no hooks, no I/O, no logging.
- Comment the clamping rule and the day-number idiom briefly, in the style of
  `ptoAccrual.ts`.
- Keep it well under 15 KB. It should be roughly 80–120 lines.

## Acceptance

Every table and bullet above is a test that already exists in the repository and
will be run against this file. They must all pass unchanged. Do not adjust the
expected values; if one looks wrong, say so in your reply instead of changing it.
