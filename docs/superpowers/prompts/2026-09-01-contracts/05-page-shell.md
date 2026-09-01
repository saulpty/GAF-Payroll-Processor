# Create the Contracts page shell

**Create exactly one new file: `src/app/pages/Contracts.tsx`.**

**No other file may be created, modified or deleted.** Do not touch `app.tsx`,
`TopNav.tsx`, `FilterBar.tsx`, `ContractsTable.tsx`, `ContractRow.tsx`, the
`loadContract*` actions, or `tenure.ts`. Routing and navigation come in the next
prompt, so the page is not reachable in the app yet — that is expected.

Model it on `src/app/pages/PtoTracker.tsx`. Same structure, same header idiom,
same export approach.

## What the page does

```tsx
export default function Contracts() {
  const [asOf] = useState(() => toLocalYMD(new Date()));   // from @/app/lib/classificationEngine
  const [dueWithin, setDueWithin] = useState<30 | 60 | 90 | null>(null);
  const [rows, setRows] = useState<ContractRowData[]>([]);
  const [counts, setCounts] = useState<{ employees: number; expiring: number; offBoard: number } | null>(null);
  …
}
```

Layout, following `PtoTracker.tsx` exactly:

```tsx
<div className="flex flex-col h-full">
  <PageHeader title="Contracts" subtitle="Tenure milestones and contract end dates — one row per employee" actions={actions} />
  <div className="flex-1 min-h-0 flex flex-col">
    <ContractsTable asOf={asOf} dueWithin={dueWithin} onRowsChange={setRows} onCountsChange={setCounts} />
  </div>
</div>
```

## The header actions

In this order, right-aligned, matching `PtoTracker`'s `actions` fragment:

1. **A count summary** in `text-[12px] text-slate-400`, only when `counts` is
   set: `44 employees · 1 ending within 30 days`. Singularise properly
   (`1 employee`, `1 ending`). When `counts.expiring === 0`, drop that clause
   entirely rather than writing "0 ending".

2. **The due-within toggle** — three buttons `30d / 60d / 90d`, styled exactly
   like the day presets in `src/app/FilterBar.tsx`: active is
   `bg-emerald-600 text-white border-emerald-600 shadow-sm`, idle is
   `bg-white text-slate-600 border-border hover:bg-emerald-50
   hover:border-emerald-300 hover:text-emerald-700`, `h-8 px-3 rounded-lg
   text-xs font-semibold border`. Clicking the active one clears it back to
   `null`. Give the group an accessible label such as `Show only upcoming`.

3. **Export** — an outline `Button` with the `Download` icon, disabled when
   `rows.length === 0`, exactly as `PtoTracker.handleExport` does it: build an
   array-of-arrays, `XLSX.utils.aoa_to_sheet`, `book_append_sheet`, then
   `XLSX.writeFile(wb, \`contracts-${asOf}.xlsx\`)`.

   Sheet name `Contracts`. Header row, then one row per row currently displayed:

   `Employee, Position, State, Start, Tenure, 1m, 3m, 6m, 1y, 2y, Contract end, Days until`

   For the five milestone columns write the **date** as plain text, not a tick.
   For `Contract end` write the date, or empty when there is none. `Days until`
   is the signed number for a contract end, blank when there is none — so the
   sheet can be sorted by urgency.

## The off-board notice

Directly under `PageHeader`, **only when `counts && counts.offBoard > 0`**,
render one line:

```
2 employees are not on the Onboarding board — fix in Admin → Employees → Monday
```

The trailing part is a `react-router-dom` `Link` to `/admin/employees?tab=monday`.
Style it as a small amber notice bar, full width, `text-[12px]`.

**Today that count is 0**, so nothing must render at all — no empty bar, no
zero. Verify that by loading the page: if a bar appears, the condition is wrong.

## Constraints

- Under 15 KB.
- No new dependencies. `xlsx` and `lucide-react` are already used by
  `PtoTracker.tsx`.
- No `new Date(` on a date string. `asOf` comes from `toLocalYMD` once, in
  `useState`'s initialiser, so it does not change on re-render.
- Every button gets `focus-visible:ring-2 focus-visible:ring-primary/30`.

## Acceptance

- One new file; nothing else touched.
- TypeScript clean.
- The toggle's three states and the cleared state all work.
- Export is disabled until rows load.
- The off-board notice does not render while the count is 0.
