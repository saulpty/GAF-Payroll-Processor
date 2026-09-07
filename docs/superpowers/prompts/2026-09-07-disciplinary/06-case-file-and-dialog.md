# Create the case file and the Close case dialog

**Create exactly two new files and modify exactly one:**

- create `src/app/pages/disciplinary/CaseFile.tsx`
- create `src/app/pages/disciplinary/CloseCaseDialog.tsx`
- modify `src/app/pages/disciplinary/DisciplinaryRow.tsx` — **only** to replace
  the placeholder in its expanded detail row with `<CaseFile … />`

**No other file may be created, modified or deleted.** Do not touch
`DisciplinaryTable.tsx`, `app.tsx`, `TopNav.tsx`, `FilterBar.tsx`, any action,
`src/app/lib/disciplinary.ts`, anything under `src/app/pages/admin/`, anything
under `src/components/ui/`, or any `Contracts*` or `Pto*` file.

## `CaseFile.tsx` — the component Employee 360 will reuse

This is the one component here with a life beyond this page. Sub-project C,
Employee 360, will render it for a single employee. So **it takes its data as
props and knows nothing about the page around it**: no `useLoadAction`, no
`useGlobalFilters`, no routing.

```tsx
interface Props {
  actions: DisciplinaryRow[];   // one employee's actions, newest first
  asOf: string;
  onChanged: () => void;        // called after a close or reopen succeeds
}
```

### Layout

**A header strip** across the top: `Actions` · `Highest level` ·
`Next re-evaluation` · `Last action`, each a small uppercase label above its
value, plus the escalation dots at a larger size. Same visual grammar as the
row's chips.

**Then the actions in the reverse of the order they arrive — oldest first.**
The prop is newest-first because that is what the table needs; the file reads as
a story, so the earliest warning comes first and the escalation is legible in
the order it actually happened. Reverse a copy; do not mutate the prop.

Each action is a card:

- **Header:** the level chip, the `final_outcome` chip if the value is non-empty,
  the `scenario` as plain muted text, and the `ref` right-aligned in a monospace
  font at `text-xs text-slate-400`.
- **Six labelled facts**, in this order, each a small uppercase label above its
  paragraph:

  | Label | Column |
  |---|---|
  | What was expected | `q_expected` |
  | What happened | `q_happened` |
  | When | `q_when` |
  | Impact | `q_impact` |
  | Expectations set | `expectations` |
  | Consequences | `consequences` |

  **Omit any fact whose value is null or empty** — do not render an empty
  heading. Several live rows have a blank `evidence_description` and one has a
  blank `prior_warnings`.

- **A meta line** below the facts, separated by a dashed top border, small and
  muted, wrapping: evidence types joined with `, ` (the column is a
  `text[]`, so guard for null before joining), evidence description, prior
  warnings, re-evaluation date, signed yes/no, the manager's name and email, and
  `Filed {fmtDate(document_date)}`.

- **A footer**, which is either:
  - **closed** — `Closed {fmtDate(closed_at)} by {closed_by}` and the
    `closure_note` if present, in a green-tinted strip, with a small **Reopen**
    link on the right; or
  - **open** — a **Close case** button on the right.

**Long text wraps and is never truncated here.** The table's Latest column is the
only place text is shortened. Some of these write-ups run to several hundred
words; they must be fully readable.

### Reuse

`StatusChip` from `@/app/components/StatusChip`, `fmtDate` from
`@/app/lib/fmtDate`, `caseState`, `levelRank` and the types from
`@/app/lib/disciplinary`, `Button` from `@/components/ui/button` (**import
only — never edit anything under `src/components/ui/`**).

## `CloseCaseDialog.tsx`

Modelled on `src/app/pages/pto/RecordApprovalDialog.tsx`. Use `Dialog`,
`DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` from
`@/components/ui/dialog`, plus `Input`, `Label`, `Textarea` and `Button`.

```tsx
interface Props {
  action: DisciplinaryRow | null;   // null = closed dialog
  onClose: () => void;
  onSaved: () => void;
}
```

- Title: **Close case**, with the employee's name and the `ref` beneath it.
- **Closed by** — an `Input`, **prefilled with the action's `manager_name`**.
  Required; the Close button is disabled while it is empty.
- **Note** — a `Textarea`, optional, placeholder
  `e.g. Employee improved; follow-up sent by email 07-10-2026.`
- Footer: **Cancel** and **Close case**.

The write:

```tsx
const [closeCase] = useMutateAction(updateDisciplinaryActionClosedAction);
// on submit:
await closeCase({ id: action.id, closedBy, note });
onSaved();
```

Parameters go in **flat**. Never `{ params: { … } }`.

Show the busy state on the button while the mutation is in flight and disable
both buttons. If it rejects, show the error text inside the dialog and leave the
dialog open with the typed values intact — do not close and lose what the user
wrote.

### Reopen

**Reopen is not a dialog.** It is a direct call from the case file's closed
footer:

```tsx
const [reopen] = useMutateAction(updateDisciplinaryActionReopenedAction);
await reopen({ id: action.id });
onChanged();
```

No confirmation prompt: reopening is itself the undo for a mis-clicked close,
and closing is the undo for a mis-clicked reopen. Adding a confirmation to a
reversible action just trains people to click through it.

## After either write

Call `onChanged()`, which the row passes up so the table reloads. The chip, the
status and the nav badge all derive from the same rows, so a single reload
updates them together. **Do not mutate the props array in place** to make the UI
update faster — a stale read from the database is a real bug and the reload is
how it is caught.

## `DisciplinaryRow.tsx` — the one modification

Replace only the placeholder `<div>` inside the expanded detail row:

```tsx
<td colSpan={COLUMNS.length} className="p-0">
  <CaseFile actions={row.actions} asOf={asOf} onChanged={onChanged} />
</td>
```

Add `onChanged: () => void` to the row's props and pass it through. **Change
nothing else in that file** — not the cells, not the chips, not the escalation
dots, not the column list.

## Dates

`'YYYY-MM-DD'` strings, compared as strings. **Never `new Date(someDateString)`.**
`closed_at` is a `TIMESTAMPTZ` and arrives as a full timestamp such as
`2026-07-15T14:02:11.000Z` — `fmtDate` already slices to 10 characters, so pass
it straight in.

## Acceptance

1. Two new files under `src/app/pages/disciplinary/`, plus a modification to
   `DisciplinaryRow.tsx` limited to the detail row and its props.
2. `CaseFile.tsx` contains no `useLoadAction` and no `useGlobalFilters` — it
   takes everything as props, so Employee 360 can render it unchanged.
3. Neither new file contains `{ params:`.
4. Neither new file contains `new Date(`.
5. Nothing under `src/components/ui/` was modified.
6. All three files are under 15 KB.
7. TypeScript compiles clean.
