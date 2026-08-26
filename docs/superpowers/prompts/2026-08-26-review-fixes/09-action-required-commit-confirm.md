# Action Required must not commit rows without showing you which

**`src/app/pages/ActionRequired.tsx` is a protected file, and this is a
functional change, not a visual one. Saul asked for it directly.**

One file only. Everything below is additive — no existing handler, query, sort,
selection or commit behaviour changes.

## The two problems

**1. `handleBulkCommit` writes to the database with no confirmation at all.**
Line ~235: it takes every selected row, calls `saveRow` on each, and reloads.
The button at line ~398 calls it directly. `PayrollMaster.tsx` guards the
equivalent action with a `showBulkConfirm` modal that lists every affected row
before writing (`PayrollMaster.tsx:562-592`). This page has nothing.

**2. The broadcast warning is unreadable.** `setEditField` (line ~170) checks
`BROADCAST_FIELDS.includes(field) && selected.has(id) && selected.size > 1` and,
when true, stages the value into **every selected row**. The only warning is a
blue tint plus a **12-pixel dot** at line ~95-102 carrying
`title="Will apply to all selected rows"` — and that badge has
`pointer-events-none`, so **the tooltip can never appear on hover.** The one
explanation of the behaviour is unreachable.

## The change

### a. Confirm before committing

- Add state next to the existing ones (~line 125):
  `const [showCommitConfirm, setShowCommitConfirm] = useState(false);`
- Change the Commit button at line ~398 from `onClick={handleBulkCommit}` to
  `onClick={() => setShowCommitConfirm(true)}`. Keep its label, icon, disabled
  state and classes exactly as they are.
- **Do not change `handleBulkCommit` itself** beyond adding
  `setShowCommitConfirm(false);` as its first statement, so confirming closes the
  modal. Its logic must stay identical.
- Render a modal when `showCommitConfirm` is true. Model it on
  `PayrollMaster.tsx:562-592` so the two pages behave alike — same overlay
  (`fixed inset-0 z-50 flex items-center justify-center bg-black/40`), same card
  (`bg-white rounded-xl shadow-xl border border-border p-6 max-w-lg w-full mx-4`).

  It must contain:
  - Heading: `Confirm Commit`
  - A line: `You are about to commit <N> row(s) to GREEN.` using the same count
    the button shows.
  - A scrollable list (`max-h-40 overflow-y-auto`) of the affected rows — for each,
    the employee name, the work date sliced to 10 characters, and the event and
    pay impact **that will actually be written**, which means the staged value
    from `edits` where one exists and the row's current value otherwise.
  - A warning line in amber: `⚠ This writes to the payroll record. Each row can
    be reverted individually from the Committed list below.`
  - `Cancel` (outline) and `Confirm & Commit` (primary). Cancel closes without
    committing. Confirm calls `handleBulkCommit`. Disable Confirm while
    `bulkSaving`.

### b. Make the broadcast state visible

- In the selection toolbar (~line 390), when `selected.size > 1`, add a short
  line of text before the Deselect all button:
  `Editing any Event, Impact or Doc field will apply to all <N> selected rows.`
  Style it to match the toolbar's existing light-on-blue text.
- Remove **`pointer-events-none`** from the badge at line ~98 so its `title`
  tooltip actually works. Change nothing else about that badge.

## Do not touch

- **No other file.**
- Do not change `setEditField`, `BROADCAST_FIELDS`, `saveRow`, `handleRevert`,
  the selection logic, the sort, the queries, or the Committed table.
- Do not remove the broadcast feature — it is a deliberate speed feature. This
  change makes it visible and puts a gate before the write, nothing more.
- Do not add an undo snapshot. This page already has per-row Revert in the
  Committed list, which is its recovery path.
- Do not change any column width, header label or `tabular-nums`.

## Acceptance criteria

- With `Q2-Aug-2026` selected, tick two or more rows and click
  **Commit N to GREEN**. A modal appears listing exactly those rows with the
  values that will be written. **Nothing is written until Confirm is clicked.**
- Cancel closes the modal and leaves the selection and staged edits intact.
- Confirm commits exactly as before — the rows move to Committed to GREEN and
  the count rises by the number committed.
- With two or more rows selected, the toolbar states that editing a field applies
  to all of them.
- Hovering the small blue badge on a broadcast field now shows its tooltip.
- Committing a single row behaves as before, via the modal.
- No console errors.

Then confirm every identifier used in the file is imported.
