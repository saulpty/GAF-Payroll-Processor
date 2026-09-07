# Create `src/app/lib/disciplinary.ts` — the pure rules for the Disciplinary page

**Create exactly one new file: `src/app/lib/disciplinary.ts`.**

**No other file may be created, modified or deleted.** Do not touch any page, any
action, `app.tsx`, `TopNav.tsx`, `FilterBar.tsx`, or any existing file in
`src/app/lib/`. Do not write a migration. This is a self-contained module;
nothing imports it yet, and that is expected.

## The timezone invariant — read this before writing a line

From `src/AGENTS.md`, and the reason this codebase carries roughly ten
successive migrations all fixing the same bug:

- Dates are `'YYYY-MM-DD'` **strings**. Compare them as strings.
- **Never call `new Date(someDateString)`.** Parsing `'2026-06-19'` yields UTC
  midnight, which is the previous calendar day in Panama (UTC-5).
- Never call `Date.now()` or `new Date()` in this module. "Today" is always
  passed in as an `asOf` parameter.
- Postgres returns full timestamps for `TIMESTAMPTZ` columns, so **slice every
  date input to 10 characters** before using it. `closed_at` is a `TIMESTAMPTZ`
  and will arrive looking like `'2026-07-15T14:02:11.000Z'`.

`src/app/lib/ptoAccrual.ts` and `src/app/lib/tenure.ts` are the models — same
style, same purity, **no imports at all**. Copy the day-number idiom exactly:

```ts
function toDayNumber(d: string): number {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, day) / 86400000);
}
```

`Date.UTC` takes numbers, so it is safe. That is the **only** permitted use of
`Date` in this file.

## The types

```ts
export type CaseState = 'closed' | 'outcome' | 'overdue' | 'open';

export interface DisciplinaryRow {
  id: number;
  ref: string;
  employee_name: string;
  manager_name: string | null;
  employee_role: string | null;
  employee_branch: string | null;
  document_date: string | null;
  revaluation_date: string | null;
  warning_level: string | null;
  final_outcome: string | null;
  scenario: string | null;
  closed_at: string | null;
  closed_by: string | null;
  closure_note: string | null;
  // Carried by the row but never read here. Optional so this module states
  // exactly what it depends on.
  manager_email?: string | null;
  q_expected?: string | null;
  q_happened?: string | null;
  q_when?: string | null;
  q_impact?: string | null;
  evidence_types?: string[] | null;
  evidence_description?: string | null;
  prior_warnings?: string | null;
  expectations?: string | null;
  consequences?: string | null;
  signature_drawn?: boolean | null;
  submitted_at?: string | null;
}

export interface EmployeeCase {
  employeeName: string;
  actions: DisciplinaryRow[];   // newest first
  highestRank: number;
  openCount: number;
  nextReval: string | null;
  latest: DisciplinaryRow;
  worstState: CaseState;
}
```

## The module must export exactly these six functions

```ts
export function levelRank(level: string | null | undefined): number;
export function caseState(row: DisciplinaryRow, asOf: string): CaseState;
export function daysBetween(from: string, to: string): number;
export function groupByEmployee(rows: DisciplinaryRow[], asOf: string): EmployeeCase[];
export function sortEmployeeCases(cases: EmployeeCase[]): EmployeeCase[];
export function dueSoon(rows: DisciplinaryRow[], asOf: string, withinDays?: number): number;
```

### `levelRank(level)`

The escalation ladder, in the order the form app offers them:

| Input | Result |
|---|---|
| `'Verbal Warning'` | `0` |
| `'First Written Warning'` | `1` |
| `'Second Written Warning'` | `2` |
| `'Final Written Warning'` | `3` |
| anything else, `''`, `null`, `undefined` | `-1` |

**Nothing in the database constrains this column** — it is free text written by
another application. An unrecognised value must return `-1` and must never
throw, and `-1` must sort *below* Verbal rather than above Final.

### `caseState(row, asOf)`

Checked strictly in this order. The order is the whole rule:

1. `row.closed_at` is a non-empty value → **`'closed'`**.
2. `row.final_outcome` is `'Suspension'` or `'Termination'` → **`'outcome'`**.
3. `row.revaluation_date` is null or empty → **`'open'`**.
4. `row.revaluation_date.slice(0,10) < asOf.slice(0,10)` → **`'overdue'`**.
5. otherwise → **`'open'`**.

Two of these are deliberate and must not be "improved":

- **Closed beats outcome.** A termination that has been closed out is finished
  business; if outcome won, it would sit at the top of the page for ever.
- **A missing re-evaluation date is `'open'`, never `'overdue'`.** The form does
  not require one. Treating a blank as infinitely late would flood the page red
  on data that says nothing.

The comparison is `<`, not `<=`: on the re-evaluation date itself the case is
still `'open'`. It becomes `'overdue'` the following day.

| Row | asOf | Result |
|---|---|---|
| reval `'2026-06-19'`, open | `'2026-06-18'` | `'open'` |
| reval `'2026-06-19'`, open | `'2026-06-19'` | `'open'` |
| reval `'2026-06-19'`, open | `'2026-06-20'` | `'overdue'` |
| reval `'2026-05-15'`, outcome `'Termination'`, `closed_at` set | `'2026-09-07'` | `'closed'` |
| reval `'2026-05-15'`, outcome `'Termination'`, open | `'2026-09-07'` | `'outcome'` |
| reval `null`, open | `'2099-01-01'` | `'open'` |

### `daysBetween(from, to)`

`toDayNumber(to) - toDayNumber(from)`. Plain calendar days, **negative when `to`
is before `from`**.

| Call | Result |
|---|---|
| `daysBetween('2026-07-07', '2026-09-07')` | `62` |
| `daysBetween('2026-06-19', '2026-09-07')` | `80` |
| `daysBetween('2026-03-07', '2026-03-09')` | `2` (US DST starts 03-08; must still be 2) |
| `daysBetween('2025-12-31', '2026-01-01')` | `1` |
| `daysBetween('2026-09-07', '2026-09-07')` | `0` |
| `daysBetween('2026-09-07', '2026-09-01')` | `-6` |

### `groupByEmployee(rows, asOf)`

One `EmployeeCase` per distinct `employee_name`. Group by the **exact string** —
do not normalise, trim or case-fold. Matching a name to a roster employee happens
elsewhere and is not this module's job.

- `actions` — **newest first: `document_date` DESC, then `id` DESC.**
  The `id` tiebreak is load-bearing, not cosmetic: one employee has two actions
  filed on the same day whose `submitted_at` values are identical too, so
  without it the file renders in whatever order the database happened to return.
  The later insert is the newer action. Rows with a null `document_date` sort
  last.
- `highestRank` — the maximum `levelRank` across the employee's actions.
- `openCount` — how many actions have a `caseState` other than `'closed'`.
- `nextReval` — the **soonest** `revaluation_date` among actions that are not
  closed and whose date is `>= asOf`. `null` when there is none. Note this is
  the soonest still ahead, not the latest, and not the soonest overall.
- `latest` — `actions[0]`, i.e. the newest.
- `worstState` — the most severe `caseState` among the employee's actions, using
  the severity order **`'overdue'` > `'outcome'` > `'open'` > `'closed'`**.
  An employee all of whose actions are closed has `worstState === 'closed'`.

The order of the returned array does not matter; `sortEmployeeCases` fixes it.

### `sortEmployeeCases(cases)`

Returns a **new** array; do not mutate the input. Compare, in order:

1. `worstState` severity ascending, so the most severe is first:
   `'overdue'` (0) → `'outcome'` (1) → `'open'` (2) → `'closed'` (3).
2. `highestRank` **descending** — a First Written outranks a Verbal.
3. `latest.document_date` **descending**, nulls last.
4. `employeeName` ascending, so the result is deterministic.

The point of rule 1 is that **an employee whose cases are all closed sinks to the
bottom regardless of how serious their history was.** That is the same reasoning
as the Contracts page, where 31 of 44 rows are `ended` and stay grey so the one
real warning is visible.

### `dueSoon(rows, asOf, withinDays = 30)`

Counts **actions**, not employees. A row counts when all three hold:

- `closed_at` is null or empty, **and**
- `revaluation_date` is not null or empty, **and**
- `revaluation_date.slice(0,10) <= ` the date `withinDays` after `asOf`.

**There is deliberately no lower bound.** An already-overdue case keeps counting
rather than ageing out of the badge and disappearing — the opposite of what this
page is for.

| Call | Result | Why |
|---|---|---|
| 7 open rows, all with re-evaluations between 06-19 and 07-30, `asOf` `'2026-09-07'` | `7` | all in the past, all still counted |
| same, one of them closed | `6` | |
| same rows, `asOf` `'2026-06-01'`, `withinDays` `10` | `0` | window ends 06-11; the soonest is 06-19 |
| same rows, `asOf` `'2026-06-01'`, `withinDays` `30` | `2` | window ends 07-01; only 06-19 and 06-23 |
| one row with `revaluation_date` null | `0` | nothing to be due |
| `[]` | `0` | |

## Acceptance

1. `src/app/lib/disciplinary.ts` is the only file that changed.
2. The file has **no `import` statement**.
3. The only occurrence of `Date` in the file is `Date.UTC(...)` inside
   `toDayNumber`. There is no `new Date(someString)`, no `new Date()` and no
   `Date.now()`.
4. Every table of examples above produces exactly the stated result.
5. The file is well under 15 KB.
6. TypeScript compiles clean.
