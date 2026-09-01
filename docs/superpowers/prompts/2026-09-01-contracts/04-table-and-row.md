# Create the Contracts table and row components

**Create exactly two new files:**

- `src/app/pages/contracts/ContractsTable.tsx`
- `src/app/pages/contracts/ContractRow.tsx`

**No other file may be created, modified or deleted.** Do not touch `app.tsx`,
`TopNav.tsx`, `FilterBar.tsx`, `src/app/lib/tenure.ts`, either
`loadContract*` action, or anything under `src/components/ui/`. The page shell
that renders `ContractsTable` comes in the next prompt — nothing imports these
two files yet, and that is expected.

Model them on `src/app/pages/pto/PtoTable.tsx` and
`src/app/pages/pto/PtoRow.tsx`. Same imports, same idioms, same look.

## The single most important rule in this change

`useLoadAction` takes its parameters **flat**:

```ts
const [rows, loading, error] = useLoadAction(
  loadContractMilestonesAction,
  [] as RawRow[],
  { manager: manager || null, employeeId: null },   // ← flat, exactly like PtoTable
);
```

**Never** `useLoadAction(action, [], { params: { … } })`. With that wrapper every
`{{params.x}}` is undefined, and the query silently returns nothing or partial
data with **no error at all**. It once left three columns reading 0 for all 45
employees while the rest of the table looked perfect.

## Dates arrive as timestamps — slice every one

Even though the action casts to `::text`, UI Bakery re-serialises dates, so
`contract_end` arrives as `"2026-09-02T00:00:00.000Z"`. **Slice every date to 10
characters before using or comparing it.** Never call `new Date(…)` on one.
"Today" is `toLocalYMD(new Date())` from `@/app/lib/classificationEngine`,
computed once in `ContractsTable` and passed down as `asOf`.

## `ContractsTable.tsx`

Loads `@/actions/loadContractMilestones`, derives display fields with
`@/app/lib/tenure`, filters, sorts, and renders `DataTable` + `ContractRow`.

The row type coming back from SQL:

```ts
type RawRow = {
  employee_id: number; display_name: string;
  role: string | null; manager: string | null;
  roster_start: string | null; board_start: string | null;
  position: string | null; state: string | null;
  contract_end: string | null; has_board_row: boolean;
};
```

Props: `{ asOf: string; onRowsChange?: (rows: ContractRowData[]) => void;
onCountsChange?: (c: { employees: number; expiring: number; offBoard: number }) => void;
dueWithin: 30 | 60 | 90 | null }`.

### Columns — use `DataTable` with `Col<ContractRowData>`

| key | label | align | tip |
|---|---|---|---|
| `display_name` | Employee | left | |
| `position` | Position | left | `From the Employee Onboarding board.` |
| `state` | State | left | `Region or operating entity from the Onboarding board — not employment status.` |
| `start` | Start | left | `The roster start date, the same one the PTO Tracker accrues from.` |
| `tenure` | Tenure | left | `Whole years and months since the start date.` |
| `m1` `m3` `m6` `y1` `y2` | 1 m, 3 m, 6 m, 1 y, 2 y | center | `Start + 1 month.` etc. Mark these `sortable: false`. |
| `contract_end` | Contract end | left | `From the board's "6 Contract End Date". Most have passed — people move to an indefinite contract and the board is not updated.` |

### Deriving each row

```ts
const start = r.roster_start ? r.roster_start.slice(0, 10) : null;
const end   = r.contract_end ? r.contract_end.slice(0, 10) : null;
const ms    = start ? milestones(start) : null;
const next  = start ? nextMilestone(start, asOf) : null;
const tenure = start ? tenureLabel(start, asOf) : null;
const endState = contractEndState(end, asOf);
const startMismatch = !!(start && r.board_start && r.board_start.slice(0,10) !== start);
```

`ContractRowData` is `RawRow` plus `start`, `end`, `ms`, `next`, `tenure`,
`endState`, `startMismatch`.

### Filtering

- `employee` and `role` from `useGlobalFilters()` filter client-side, case
  insensitively, exactly as `PtoTable` does.
- `manager` is passed to the action as a parameter (not filtered client-side).
- `dueWithin`: when not null, keep a row only if
  `(next && next.days <= dueWithin) || (endState.kind === 'future' && endState.days !== null && endState.days <= dueWithin)`.

### Sorting

Default sort: **soonest upcoming event first**, then name. The sort value for a
row is the smaller of `next?.days` and a future `endState.days`; a row with
neither sorts last. Reuse `sortRows` / `nextSortDir` from `@/app/lib/ptoSort`
for the click-to-sort behaviour on the sortable columns.

### States

- While loading, render the `Loader2` spinner exactly as `PtoTable` does.
- On error, render the error, with a Retry button calling the action's reload.
  A single failing load here is usually connection pressure, not a defect.
- If there are no rows after filtering, render `EmptyState`.
- Report counts up through `onCountsChange`: `employees` = rows after filtering,
  `expiring` = rows whose `endState.kind === 'future' && days <= 30`,
  `offBoard` = rows with `has_board_row === false`.

## `ContractRow.tsx`

One `<tr>`. Export the `ContractRowData` interface from here and import it into
the table, mirroring how `PtoRow` exports `PtoRowData`.

- **Employee** — name. Under it, `role` in small muted text if present.
- **Position / State** — plain text; `—` muted when blank. Use the
  `const muted = <span className="text-slate-300">—</span>` idiom from `PtoRow`.
- **Start** — `fmtDate(start)`. When `startMismatch`, follow it with a small ⚠
  whose `title` names both dates. When `start` is null, render `muted` plus a
  small amber `No start date` chip.
- **Tenure** — the label, or `muted`.
- **Milestones** — for each of the five, in order:
  - already passed → a muted `✔` with `title` = the formatted date
  - it is the next one → the date plus `in N d`, in a subtle highlight
    (`bg-primary/10`, medium weight) — `N` from `next.days`, and `today` when 0
  - still ahead but not next → `fmtDate(date)`, muted
- **Contract end** — driven only by `endState.kind`:
  - `future` and `days <= 30` → **red** chip, `MM-DD-YYYY · in N d`
  - `future` and `days <= 60` → **amber** chip, same text
  - `future`, further out → plain `fmtDate`, no chip
  - `ended` → **muted** text `ended MM-DD-YYYY`. **No chip, no colour.**
  - `none` → `muted`
- When `has_board_row` is false, render `—` for position, state and contract
  end, and a small slate `Not on Onboarding board` chip next to the name.

**Why `ended` must stay grey:** 31 of the 44 employees are in that state today.
Colouring it would make almost the whole page look like a warning and hide the
one row that actually needs attention.

## Constraints

- Both files well under 15 KB.
- Keyboard: any interactive element gets a visible focus ring, matching the
  `focus-visible:ring-2 focus-visible:ring-primary/30` used across the app.
- Status must never be carried by colour alone — every chip has text.
- No new dependencies.

## Acceptance

- Two new files; nothing else touched.
- TypeScript clean.
- `useLoadAction` is called with flat params — no `params:` wrapper anywhere.
- Every date is `.slice(0, 10)`-ed before use; no `new Date(` on a date string.
