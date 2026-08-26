# Correction: the commit modal is inside the wrong component and crashes the page

**`src/app/pages/ActionRequired.tsx` — the previous change broke this page.**
Loading Action Required and selecting a period now renders
**"Something went wrong."** and no rows at all.

Most of the last change is correct and must be kept. Only the modal's **location**
is wrong.

## What went wrong

The commit-confirmation modal was inserted **inside the `BroadcastSelect`
component** — the small per-cell dropdown at the top of the file, whose whole
body is `<div className="relative"> <select…/> {badge} </div>`. The modal was
added as a sibling of that badge, still inside `BroadcastSelect`.

`BroadcastSelect` only receives `value`, `options`, `placeholder`, `broadcasting`
and `onChange`. It has no access to `showCommitConfirm`, `filtered`, `selected`,
`edits`, `bulkSaving` or `handleBulkCommit` — all of which live in the
`ActionRequired` component further down the file. Every one of those is an
undefined reference, so the component throws the moment it renders, which is as
soon as a period is chosen and rows appear.

## The fix

**Move the entire modal block out of `BroadcastSelect` and into the
`ActionRequired` component's returned JSX**, where all those variables are in
scope.

- `BroadcastSelect` must go back to exactly what it was, except keep the badge
  without `pointer-events-none` — that part of the last change was correct.
  Its body ends with the badge `<span>`, then `</div>`, and nothing else.
- Place the modal in `ActionRequired`'s JSX as a **top-level sibling near the end
  of the returned markup**, after the Committed-to-GREEN section, the same way
  `PayrollMaster.tsx` places its `showBulkConfirm` modal at `:562`. It is
  `position: fixed`, so its position in the markup does not affect layout.
- Keep the modal's contents exactly as written — the heading, the count line, the
  scrollable table of employee / date / Event 1 / Pay Impact 1 built from
  `edits[row.id] ?? row`, the amber warning, and the Cancel / Confirm & Commit
  buttons.

## Keep these — they are already correct

- `const [showCommitConfirm, setShowCommitConfirm] = useState(false);`
- `setShowCommitConfirm(false);` as the first line of `handleBulkCommit`
- The Commit button calling `() => setShowCommitConfirm(true)`
- The toolbar text `Editing any Event, Impact or Doc field will apply to all N
  selected rows.` shown when `selected.size > 1`
- The badge with `pointer-events-none` removed

## Do not touch

- **No other file.**
- Do not change `setEditField`, `BROADCAST_FIELDS`, `saveRow`, `handleRevert`,
  the selection logic, sorting, queries, column widths or header labels.
- Do not change `handleBulkCommit`'s logic beyond the one line already added.

## Acceptance criteria

- **Action Required loads with `Q2-Aug-2026` selected and renders its rows.** No
  "Something went wrong." This is the criterion that matters — the page is
  currently broken.
- Selecting two or more rows and clicking **Commit N to GREEN** opens the modal
  listing exactly those rows. Nothing is written until Confirm is clicked.
- Cancel closes it and leaves the selection and staged edits intact.
- The Committed to GREEN list still renders below.
- No console errors.

Then confirm every identifier used in the file is imported, and that no
identifier is referenced outside the component that defines it.
