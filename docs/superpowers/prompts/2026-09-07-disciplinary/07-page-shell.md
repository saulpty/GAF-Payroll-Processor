# Create `src/app/pages/Disciplinary.tsx` — the page shell

**Create exactly one new file: `src/app/pages/Disciplinary.tsx`.**

**No other file may be created, modified or deleted.** Do not add the route yet,
do not touch `app.tsx`, `TopNav.tsx`, `FilterBar.tsx`, any action, anything under
`src/app/pages/disciplinary/`, `src/app/lib/disciplinary.ts`, anything under
`src/app/pages/admin/`, anything under `src/components/ui/`, or any `Contracts*`
or `Pto*` file.

**The page will not be reachable after this prompt** — the route comes next.
That is expected and is not a bug to fix.

`src/app/pages/Contracts.tsx` is the model: a thin shell that owns the header,
the toggle and the export, and hands everything else to the table.

## Structure

```tsx
export default function Disciplinary() {
  const [asOf] = useState(() => toLocalYMD(new Date()));
  const [statusFilter, setStatusFilter] = useState<'all'|'open'|'overdue'|'closed'>('all');
  const [rows, setRows] = useState<DisciplinaryRowData[]>([]);
  const [counts, setCounts] = useState<{ employees: number; actions: number; open: number } | null>(null);
  …
}
```

`toLocalYMD` comes from `@/app/lib/classificationEngine` — **import it, never
edit that file.** It is how this codebase gets "today": `new Date()` gives the
local instant and `toLocalYMD` renders it as a local `YYYY-MM-DD`.
`toISOString().slice(0,10)` is the bug this replaces, and it is wrong by a day
for most of the Panama evening.

Render `PageHeader` then `<DisciplinaryTable asOf={asOf} statusFilter={statusFilter}
onRowsChange={setRows} onCountsChange={setCounts} />`, inside the same
`flex flex-col h-full` wrapper `Contracts.tsx` uses.

## The header

- **title** — `Disciplinary actions`
- **subtitle** — `One row per employee with a record. Expand a row to read the file.`
- **actions**, in this order:

### 1. The count summary

Muted `text-[12px] text-slate-400`, rendered only when `counts !== null`:

```
5 employees · 7 actions · 7 open
```

Pluralise each noun. Omit the `open` clause entirely when it is 0 — a page with
nothing open should not display a zero.

### 2. The status toggle

Four buttons — **All · Open · Overdue · Closed** — styled exactly like the
30/60/90 buttons in `Contracts.tsx`: `h-8 px-3 rounded-lg text-xs font-semibold
border`, active state filled, inactive white with a hover tint. Clicking the
active one returns to `All`. Give the group `role="group"` and an
`aria-label="Filter by case status"`, and each button `aria-pressed`.

Use a colour that reads as severity rather than the emerald the Contracts page
uses for its neutral toggle: active **Overdue** in red, active **Open** in
amber, active **Closed** in emerald, active **All** in slate.

### 3. Export

An outline `Button` with the `Download` icon from lucide, disabled when
`rows.length === 0`, exactly as `Contracts.tsx` does it.

## The export

`xlsx`, imported as `import * as XLSX from 'xlsx'`, copied from
`Contracts.tsx`'s `handleExport`.

**One row per action, not per employee.** The screen groups by person; the
spreadsheet is a register. Flatten `rows` by iterating each employee's `actions`.

Header row, exactly these thirteen columns:

```
Employee, Role, Branch, Manager, Date, Level, Outcome, Scenario,
Re-evaluation, Status, Closed on, Closed by, Ref
```

- `Date` is `fmtDate(document_date)`, `Re-evaluation` is
  `fmtDate(revaluation_date)`, `Closed on` is `fmtDate(closed_at)`.
- `Status` is the per-action `caseState(action, asOf)` rendered as a word:
  `Closed`, `Outcome`, `Overdue`, `Open`.
- Empty values are `''`, never `null` or `undefined`.

**No narrative columns.** `q_expected`, `q_happened`, `q_when`, `q_impact`,
`expectations`, `consequences` and `closure_note` are all excluded — several run
to a few hundred words and would make the sheet unusable.

Sheet name `Disciplinary`. Filename `disciplinary-${asOf}.xlsx`.

## Do not add

- No page-level `useLoadAction`. The table owns loading; the shell receives
  counts through `onCountsChange`, exactly as `Contracts.tsx` does.
- No summary tiles or big-number cards. The page is a table.
- No "add action" or "new action" control. Actions are authored in the other
  application; this page is read-only apart from closing a case.
- No PDF download control. That was decided against, and the two base64 columns
  are not even selected.

## Acceptance

1. `src/app/pages/Disciplinary.tsx` is the only file that changed.
2. It contains no `useLoadAction` and no `{ params:`.
3. Today comes from `toLocalYMD(new Date())`; the file contains no
   `toISOString()`.
4. `classificationEngine.ts` was not modified.
5. The file is under 15 KB.
6. TypeScript compiles clean. The page is still unreachable — the next prompt
   adds the route.
