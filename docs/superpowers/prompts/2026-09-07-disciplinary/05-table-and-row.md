# Create the Disciplinary table and row

**Create exactly two new files, and nothing else:**

- `src/app/pages/disciplinary/DisciplinaryTable.tsx`
- `src/app/pages/disciplinary/DisciplinaryRow.tsx`

**No other file may be created, modified or deleted.** Do not create
`Disciplinary.tsx` yet, do not add a route, do not touch `app.tsx`,
`TopNav.tsx`, `FilterBar.tsx`, any action, `src/app/lib/disciplinary.ts`,
`src/app/lib/mondayResolve.ts`, `classificationEngine.ts`, anything under
`src/app/pages/admin/`, anything under `src/components/ui/`, and any
`Contracts*` or `Pto*` file. Nothing imports these two yet, and that is expected.

`src/app/pages/contracts/ContractsTable.tsx` and `ContractRow.tsx` are the
model. Follow their structure closely: the table owns loading, filtering and
sorting; the row owns one `<tr>` and its chips.

## What this page shows

One row per **employee** who has at least one disciplinary action, not one row
per action. An employee's individual actions live inside the expanded row, which
a later prompt builds — for now expansion renders a placeholder.

## Reuse, do not reinvent

- `useLoadAction` from `@uibakery/data`
- `DataTable`, `Col` from `@/app/components/DataTable`
- `EmptyState` from `@/app/components/EmptyState`
- `StatusChip` from `@/app/components/StatusChip`
- `useGlobalFilters` from `@/app/context/GlobalFilterContext`
- `fmtDate` from `@/app/lib/fmtDate`
- `sortRows`, `nextSortDir`, `SortDir` from `@/app/lib/ptoSort`
- `levelRank`, `caseState`, `daysBetween`, `groupByEmployee`,
  `sortEmployeeCases` and the types `DisciplinaryRow`, `EmployeeCase`,
  `CaseState` from `@/app/lib/disciplinary`
- `buildResolver` from `@/app/lib/mondayResolve` and `normalizeName` from
  `@/app/lib/classificationEngine`
- `loadDisciplinaryActions`, `loadAllEmployees`, `loadNameAliases` from
  `@/actions/…`

## Parameters go in FLAT — this bug has been found three times

```tsx
const [rawRows, loading, error, reload] = useLoadAction(
  loadDisciplinaryActionsAction,
  [] as DisciplinaryRow[],
  { manager: manager || null, employeeName: null },   // ← FLAT
);
```

**Never** `useLoadAction(action, [], { params: { … } })`. With the wrapper every
`{{params.x}}` is undefined, the query silently returns nothing or partial data,
and no error appears anywhere. It has cost this project three separate
incidents. The other two loads take no parameters:

```tsx
const [emps]    = useLoadAction(loadAllEmployeesAction, []);
const [aliases] = useLoadAction(loadNameAliasesAction, []);
```

## Matching a name to an employee

The disciplinary database is a **different Postgres instance** with no employee
id and no email — only a free-text `employee_name`. So the join happens here, in
React, and it must use the existing resolver. `src/AGENTS.md`: *"Do not write
another name-matcher."*

```tsx
const resolver = useMemo(() => buildResolver(emps, aliases, normalizeName), [emps, aliases]);
const empById  = useMemo(() => new Map(emps.map(e => [e.id, e])), [emps]);
// The disciplinary rows carry no email, so pass null for it:
const employeeId = resolver(row.employee_name, null);
```

For each employee group, resolve once and derive:

- **matched** — `employeeId !== null`. Display the roster's `display_name`,
  `role` and `active`.
- **unmatched** — display the form's own `employee_name`, `employee_role` and
  `employee_branch`, and set a flag the row renders as a slate
  **not on roster** chip.

**An unmatched row is displayed, never dropped.** Dropping it would hide a real
disciplinary action because of a spelling difference, which is the worst thing
this page could do. It is also the signal that an alias is needed.

## `DisciplinaryRow.tsx`

Export the row component as default and the row's data type:

```tsx
export interface DisciplinaryRowData extends EmployeeCase {
  employeeId: number | null;
  displayName: string;      // roster name when matched, else the form's name
  role: string;
  branch: string;
  manager: string;
  active: boolean;          // true when unmatched — do not mute a row we cannot resolve
  onRoster: boolean;
}
```

The component takes `{ row, asOf, expanded, onToggle }` and returns a
**fragment of two `<tr>` elements**: the summary row, and — only when
`expanded` — a detail row whose single `<td>` carries
`colSpan={COLUMNS.length}`. `DataTable` renders its children directly into
`<tbody>`, so a fragment of two `<tr>`s is valid.

For this prompt the detail row's content is a placeholder:

```tsx
<div className="px-6 py-4 text-sm text-slate-400">
  Case file — {row.actions.length} action{row.actions.length === 1 ? '' : 's'}.
</div>
```

A later prompt replaces that with the real case file. Do not build it now.

### The cells

| Column | Content |
|---|---|
| Employee | `displayName` in `font-medium`; muted when `!active`. A second line, `text-xs text-slate-500`: `role` · `branch`. A slate `StatusChip` reading **not on roster** when `!onRoster`, and one reading **inactive** when `!active`. |
| Manager | `manager` |
| Actions | `actions.length`, right-aligned |
| Highest level | a `StatusChip` for `highestRank` — see the tone table. Plus a separate `red` chip for the `final_outcome` of the newest action carrying one, if any. |
| Escalation | four dots, filled to `highestRank` |
| Latest | `fmtDate(latest.document_date)`, then the scenario in `text-slate-500` |
| Status | see the status table |
| (last) | a chevron button that calls `onToggle`, rotated when `expanded` |

### Level tones

| `highestRank` | label | `StatusChip` tone |
|---|---|---|
| `3` | Final Written | `red` |
| `2` | Second Written | `amber` |
| `1` | First Written | `amber` |
| `0` | Verbal | `slate` |
| `-1` | the raw `warning_level` string as stored | `slate` |

Rank `-1` means the other application wrote a value this page has never seen.
**Show the string; do not show "Unknown" and do not throw.**

### Status, from `worstState`

| `worstState` | chip | tone |
|---|---|---|
| `'overdue'` | `review overdue {N} d` where `N = daysBetween(nextOverdueDate, asOf)` | `red` |
| `'outcome'` | the outcome, e.g. `Termination` | `red` |
| `'open'` with `nextReval` | `re-eval {fmtDate(nextReval)}` | `amber` |
| `'open'` without `nextReval` | `no re-evaluation set` | `slate` |
| `'closed'` | `all closed` | `green` |

### The escalation dots

Four small circles in a row, connected by short bars. Filled up to and including
`highestRank`, hollow after it. Use the same colour as the level chip's tone.
Give the group an `aria-label` such as
`Escalation: First Written Warning, 2 of 4`. Plain divs and Tailwind — do not
add a charting library.

## `DisciplinaryTable.tsx`

Props:

```tsx
interface Props {
  asOf: string;
  statusFilter: 'all' | 'open' | 'overdue' | 'closed';
  onRowsChange?: (rows: DisciplinaryRowData[]) => void;
  onCountsChange?: (c: { employees: number; actions: number; open: number }) => void;
}
```

Pipeline, each stage its own `useMemo`, exactly as `ContractsTable` does it:

1. **derive** — resolve each distinct `employee_name`, group with
   `groupByEmployee(rawRows, asOf)`, and build `DisciplinaryRowData`.
2. **filter** —
   - `employee` (global): substring match, case-insensitive, against
     `displayName`.
   - `role` (global): substring match against `role`.
   - `statusFilter`: `'open'` keeps `worstState` of `'open'`, `'outcome'` or
     `'overdue'`; `'overdue'` keeps only `'overdue'`; `'closed'` keeps only
     `'closed'`; `'all'` keeps everything.
   - `manager` is **not** filtered here — it is already applied in SQL.
3. **sort** — when no column is chosen, `sortEmployeeCases(filtered)`. When one
   is, `sortRows(filtered, sortKey, sortDir, 'displayName')`.

Track `expandedName: string | null` in state and toggle it, so **one row is open
at a time** — these files are long and two open at once is unreadable.

Report counts up in a `useEffect`, the same shape `ContractsTable` uses:
`employees` is the number of rows, `actions` the sum of `actions.length`, `open`
the number of actions whose `caseState` is not `'closed'`.

### The three states

- **loading** — centred `<Loader2 className="animate-spin" />` and "Loading…" at
  `py-16 text-slate-400`, copied from `ContractsTable`.
- **error** — the red-50 banner naming the action, with a Retry button calling
  `reload`: `Couldn't load disciplinary actions — loadDisciplinaryActions`.
- **empty** — `<EmptyState compact title="No employees match" hint="Try clearing
  the search or filters." />` inside a `<td colSpan={COLUMNS.length}>`.

## Dates

Every date is a `'YYYY-MM-DD'` string, compared as a string. **Never
`new Date(someDateString)`** — it yields UTC midnight, the previous calendar day
in Panama. All date maths goes through `daysBetween` from
`@/app/lib/disciplinary`. Slice anything from Postgres to 10 characters;
`closed_at` is a `TIMESTAMPTZ` and arrives as a full timestamp.

## Acceptance

1. Exactly two new files, both under `src/app/pages/disciplinary/`.
2. **Neither file contains `{ params:`.**
3. Neither file contains `new Date(` other than nothing at all — there should be
   no `Date` construction in either file.
4. Neither file mentions `pdf_en_base64` or `pdf_es_base64`.
5. Neither file contains its own name-matching logic; both go through
   `buildResolver`.
6. Both files are under 15 KB.
7. TypeScript compiles clean. The page is not reachable yet, so there is nothing
   to load in the browser — that comes two prompts later.
