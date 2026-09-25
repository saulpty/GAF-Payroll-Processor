# Impeccable critique + audit: Action Required (2026-09-25)

Method: Assessment A (design review) done in this agent from source; Assessment B
(deterministic detector) done by a separate sub-agent. No browser pass: the app runs
only in UI Bakery, so everything here comes from reading the code. Mode: **Operate**
(1–2 HR people on laptops, dense table, speed and accuracy first).

Scope: `src/app/pages/ActionRequired.tsx`, `src/app/pages/action-required/*`,
`src/app/components/ds/*`, `src/app/lib/fmtTime.ts`, `fmtDay.ts`, plus
`src/app/components/TimeInput.tsx` (used in every row). Already decided and not raised
again here: Late/Early columns becoming plain black text, the Payroll Master split being
deferred, and the deletion of `ArBits.tsx`.

**Size warning before anything else:** `ActionRequired.tsx` is **14,379 bytes**, 600
bytes under the 15 KB cap. Every fix below is placed in a child file or hook for that
reason. Do not add logic to the page file itself.

Detector (`detect.mjs --json` on the page, `action-required/`, `ds/`): **exit 0, zero
findings.** The anti-pattern scan is clean. Every issue below is a UX, accessibility or
consistency judgement that the detector does not cover.

---

## Design Health Score (Nielsen)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Toasts, reload dim, live Discount and counts are good. Revert succeeds silently. Rows have no saving/saved/error state (DESIGN.md asks for one). |
| 2 | Match System / Real World | 3 | Speaks HR/Excel. The confirm dialog says "GREEN" in capitals and "row(s)". The grid says In/Out, but errors say "Entry/Exit". "Doc" is an abbreviation. |
| 3 | User Control and Freedom | 3 | Commit has Undo and Revert. **Discard All** has no confirm and no undo. A period change silently throws away drafts. Undo disappears after 5 s. |
| 4 | Consistency and Standards | 2 | The confirm dialog is still pre-redesign: raw `2026-09-07` dates, blue impact text, the default navy button, ⚠ glyph, capitals. Column widths drift from DESIGN.md. |
| 5 | Error Prevention | 3 | Refusal reasons, "Pick an event first", time validation. But the confirm hides Event 2, Impact 2 and the Discount, and the table stays keyboard-editable while "locked" for reload. |
| 6 | Recognition Rather Than Recall | 2 | The table is about 2,100 px wide. Only the checkbox and name stick, so the **date scrolls away** while you set Event/Impact. Auto-Notes (why the row is here) sits at the far right. |
| 7 | Flexibility and Efficiency | 3 | Bulk bar, shift-click ranges, broadcast edits, event filter, keyboard combobox. Weak points: no shortcuts, and even a one-row commit needs the modal. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm, disciplined Warm palette, with status fills kept to Excel meaning. The per-row Commit pill squeezes the name, and slate-300 dashes are everywhere. |
| 9 | Error Recovery | 2 | Failures are only a toast listing "Name YYYY-MM-DD". The failed row itself is never marked, so HR has to hunt for it. |
| 10 | Help and Documentation | 2 | Titles on broadcast and unsaved state, and a helpful empty-state line. Nothing explains what Discount / Paid mean or how Impact colours map to pay. |
| **Total** | | **26/40** | **Acceptable** (upper end) |

### Technical audit (audit.md)

| Dimension | Score | Key finding |
|---|---|---|
| Accessibility | 2 | In/Out and Notes inputs have no accessible name. The confirm modal is not a dialog (no role, Esc or focus handling). Toasts are added to the page with no live region already in place to announce them. |
| Performance | 3 | The Committed list is capped at 100 (good). Every row reruns `computePunchMinutes` + `computeDiscount` on each parent render, which is fine at today's row counts. |
| Responsive | 2 | Laptop-only is acceptable, but the column widths add up to about 2,094 px against a `minWidth` of 1,880, so it always scrolls sideways. |
| Theming | 3 | Warm/status tokens are used almost everywhere. Raw `red-700`, `green-50/300/600/800`, `blue-700` and `amber-*` show up in the confirm, the empty state and the helper text. |
| Implementation integrity | 3 | Detector clean, with clear AR-x provenance comments. Drift from DESIGN.md: row states, column widths, sortable/filterable categorical columns. |
| **Total** | **13/20** | **Acceptable** |

---

## Design specificity verdict

This page belongs to this product. The Excel status fills, the orange selection bar and
the live **Discount** column all come from how GAF HR actually works. Discount is
recomputed with the same `computeDiscount` the save uses, and "Paid" only appears once
every chosen event has an impact. The broadcast ring ("Applies to all N selected rows")
is a thoughtful, product-specific guard. The weakest part is the **commit confirmation
modal**: it was never brought into the redesign, and it is the one screen that stands
between an edit and a payroll write.

## What's working

1. **Discount is honest and live.** `ArRow.tsx:40-46` runs the exact save-path maths, so
   what HR sees is what payroll gets.
2. **Broadcasting is deliberate.** It only happens with a 2+ checkbox selection, only to
   visible rows, and each row keeps its own times (`ActionRequired.tsx:84-107`). It is
   shown with a ring and a title (`ArRow.tsx:52`). This removes a whole class of silent
   mass edits.
3. **Commit flow resilience.** Each row is saved independently. Refusals come with
   reasons. Undo restores the exact loaded row (`useArSave.ts:77-91`). Committed rows
   leave at once, and drafts drop only after the reload (`useArCommit.ts:92-97`).

---

## Ranked findings

### P1: fix before the next payroll run

**1. The commit confirmation hides what is being written.** `ArConfirm.tsx:26-54`
- *Wrong:* it lists only Employee, Date, Event 1 and Pay Impact 1. Event 2, Impact 2 and
  the **Discount the commit will apply** are missing. The date is raw `2026-09-07` in
  mono (`:47`), impact text is off-palette `text-blue-700` (`:49`), and the copy says
  "row(s) to GREEN" (`:22`). This is the last check before a payroll write, and it is
  the least informative screen in the flow.
- *Fix:* add a Discount column, using the same `discountLabel(computeDiscount(...))`
  call as ArRow. Move that call into a small `arDiscount(row, edit)` helper in
  `arLogic.ts` so both screens share it. Show `Event 2 / Impact 2` only when present.
  Format the date with `fmtDay`, show impacts with the `IMPACT_DOT` dot, and word it as
  `Commit 3 Rows to Green` / `1 row will be skipped`. Put a total line on top, for
  example `3 rows · 1h 15m deducted`.

**2. The confirm modal is not an accessible dialog.** `ArConfirm.tsx:18-19`
- *Wrong:* it is a plain `div` with no `role="dialog"`, no `aria-modal`, no
  `aria-labelledby` pointing at the h2, no Esc to cancel and no initial focus. Keyboard
  focus stays behind the overlay, so Tab walks the grid under the modal.
- *Fix:* add `role="dialog" aria-modal="true" aria-labelledby` and an `onKeyDown` Esc
  handler that calls `onCancel`. Autofocus the Confirm button, which also makes
  Enter-to-confirm fast for Alex. `src/components/ui/dialog` could be used instead
  without editing it, but the three attributes are the smaller change.

**3. The In, Out and Notes inputs have no accessible name.** `ArRow.tsx:80, 83, 108`;
`TimeInput.tsx:30-38`
- *Wrong:* the only "label" is the placeholder (`9:00 AM`, `5:00 PM`, `Add a note`), and
  it disappears when the box has a value. A screen reader announces "edit text, 9:05 AM"
  with no column or row. The Comboboxes get this right: `Event 1, Ana 2026-09-07`. The
  "Not a real time" error is also not linked to its input.
- *Fix:* give `TimeInput` an `ariaLabel` prop and pass
  `In, ${name} ${date}` / `Out, ...`. Add `aria-label={`Notes, ${name} ${date}`}` to the
  notes input. Inside TimeInput, add `aria-describedby` for the error span.
  `TimeInput.tsx` is 1.5 KB, well under the cap.

**4. Changing the period silently discards unsaved drafts.** `ActionRequired.tsx:70-78`
- *Wrong:* the effect calls `discardAll()` on every period change. `useRowEdits` asks
  before the browser *unloads*, but not before this. An HR person who edits 12 rows and
  then checks another period loses all 12 with no message.
- *Fix (minimum):* in the same effect, if `dirtyCount > 0`, show a toast:
  `Discarded 12 unsaved changes`. Doing this in a hook keeps the page file small.
  *Better:* keep drafts per period, keyed by id, since ids are unique across periods,
  and don't discard. That is a behaviour change to `useRowEdits`, so it needs Saul's
  decision.

**5. The date scrolls out of view while you decide pay.** `ArRow.tsx:60-78`,
`ArHead.tsx:38-45`
- *Wrong:* the columns add up to about 2,094 px, and only the checkbox and Employee are
  sticky. By the time you reach Event/Impact (x ≈ 880–1,550) the Date column is off
  screen, and you are choosing pay for "Ana" without seeing which day. Auto-Notes, the
  system's explanation of *why* the row is flagged, sits at x ≈ 1,700 and is truncated
  at 220 px.
- *Fix:* make Date sticky too (`sticky left-[216px] z-10 ${tint}` on the cell and the
  header), or print the short date as a second line under the name inside the sticky
  Employee cell (`text-[11px] text-slate-500`). Either way, drop the Date column's own
  96 px. Consider moving Auto-Notes to just after Shift. Also align `minWidth` with the
  real sum, or remove it.

### P2: fix in the next pass

**6. Discard All is one click, with no confirm and no undo.** `ArCommitBar.tsx:35-38`
- It looks like a neutral status chip ("3 Unsaved · Discard All") but destroys work.
- *Fix:* make the label two parts, a count `3 Unsaved` plus a separate text button
  `Discard All`. On click, snapshot `edits` and show the toast with `onUndo` that
  restores them. That needs `useRowEdits` to expose a `restoreAll(snapshot)`, which
  lives in lib, not the page.

**7. The "locked while reloading" table still accepts keyboard input.**
`ActionRequired.tsx:214-215`
- `pointer-events-none` stops the mouse only. Tab + type still edits, and Space still
  toggles, while the old period's rows are shown. The comment promises this is
  impossible.
- *Fix:* add the `inert` attribute while `loading`: `inert={loading ? '' : undefined}`.
  This is a one-attribute change, but it lands on the page file (about 40 bytes, which
  fits).

**8. Failed or refused rows are not marked in the table.** `useArCommit.ts:85-86`
- The toast lists `Ana López 2026-09-07 (Pick an event first)`, and the row itself looks
  unchanged. DESIGN.md says: "error (red, stays until fixed)".
- *Fix:* return a `failedIds: Map<id, reason>` from `useArCommit`. In ArRow, when a row
  has one, show a red left bar plus a single `text-[11px] text-red-700` reason line,
  cleared on the next edit of that row. Use `fmtDay` in the toast labels instead of the
  raw date.

**9. Revert gives no feedback on success.** `useArCommit.ts:100-111`
- The row disappears from Committed and reappears above, with no toast. Every other
  write in this flow announces itself.
- *Fix:* `toast.show({ message: `Moved ${name} back to Action Required` })` after
  `refresh()`.

**10. The Toast live region and the Undo timeout.** `Toast.tsx:41-49, 31-33`
- Each toast mounts already carrying `role="status"`, and screen readers often skip
  live regions inserted along with their content. The 5 s auto-dismiss removes **Undo
  of a payroll commit** with no pause on hover or focus (WCAG 2.2.1).
- *Fix:* keep the container always mounted with `aria-live="polite"`, with errors in
  their own always-mounted `aria-live="assertive"` region. Pause the timer on
  `onMouseEnter` / `onFocus`, and give toasts that carry `onUndo` 10 s.

**11. In search mode the Combobox loses the active-option link.** `Combobox.tsx:130-134,
164-176`
- When searchable (>7 options), focus moves to the search `<input>`, but
  `aria-activedescendant` and `aria-controls` stay on the button. A screen reader hears
  nothing while arrowing through Events.
- *Fix:* put `role="combobox" aria-expanded aria-controls={listId}
  aria-activedescendant={activeId}` on the search input too. Also add type-to-jump for
  lists of 7 or fewer (Impact, Doc): first-letter match on keydown.

**12. The Updated time is probably shown in UTC.** `ArCommitted.tsx:24-25`
- `fmtTime(u.slice(11, 16))` on a stored timestamp. If Postgres returns
  `2026-09-25T23:58:00+00`, Panama HR sees 11:58PM for a 6:58PM commit. Verify one row
  against the DB before changing anything. If it is UTC, format it on the server
  (`to_char(updated_at AT TIME ZONE 'America/Panama', ...)`) in
  `loadCommittedEntries`. Do not use `new Date` here.

**13. Placeholder contrast.** `Combobox.tsx:141` (`text-slate-400` for empty values
and "All Events"), with `text-slate-300` dashes throughout ArRow and ArCommitted.
- "All Events" is the *current filter state*, not decoration, and it sits at about
  2.6:1 against a 4.5:1 target. The slate-300 dashes are about 1.5:1.
- *Fix:* use `text-slate-500` for Combobox placeholder text. The empty-cell dashes can
  stay light, but use `text-slate-400` and add `aria-hidden` plus an sr-only "empty".

### P3: polish

14. **Copy consistency.** "In/Out" (grid) vs "Entry or Exit is not a real time"
    (`arLogic.ts:46`) and "Entry and Exit must look like 9:05 AM"
    (`useArCommit.ts:73`): use "In or Out". Toast says "to green" (`useArCommit.ts:88`)
    and the button says "to Green": pick "Green" everywhere, since it is a status name.
    "Doc" header (`ArHead.tsx:56`) → "Documentation", or keep "Doc" with a
    `title="Documentation"`.
15. **Column widths drift from DESIGN.md.** Date 96 vs 92, times 88 vs 84, minutes 70
    vs 56, discount 104 vs 86 (`ArRow.tsx:78-88`, `ArHead.tsx:45-51`). Either update
    DESIGN.md to the shipped values or tighten the code. Tightening also helps finding 5.
16. **Categorical columns that can't be sorted.** DESIGN.md says every categorical
    column is sortable *and* filterable. Event 2, Impact 2 and Doc are plain `<th>`
    (`ArHead.tsx:54-56`), and there is no Impact filter.
17. **Late/Early sort uses the stored minutes while the cells show live ones.**
    `arLogic.ts:14-19` sorts `row.late_minutes`, but ArRow shows the value recomputed
    from edited punches, so after an edit the sort order and the numbers disagree.
18. **The per-row Commit pill squeezes the name.** `ArRow.tsx:69-74` sits inside the
    176 px Employee cell. When it appears (on dirty/select), the name truncates harder
    and shifts. Consider a fixed 24 px icon-only button with `aria-label` in a reserved
    slot, or its own narrow column.
19. **The "Pick an event first" pulse plays only once.** `flashKey={invalid ? 1 : 0}`
    (`ArRow.tsx:54`) is constant, so choosing a second impact without an event doesn't
    re-pulse. Pass an incrementing counter.
20. **Raw palette in the empty state and helper text.** `ActionRequired.tsx:189-193`
    (`green-*`), `ArRow.tsx:95,100` (`red-700`), `ArConfirm.tsx:56` (`amber-*`, ⚠). Use
    status tokens. Low priority, because `ActionRequired.tsx` has no room to grow.
21. **The unsaved dot is invisible to screen readers.** `ArRow.tsx:68`: add
    `<span className="sr-only">Unsaved</span>`, or `role="img" aria-label="Unsaved changes"`.
22. **`dirtyCount` counts drafts in the other tab.** "3 Unsaved" can show on the Yellow
    tab when all three drafts are Red rows. Say `3 Unsaved (2 in Red)`, or count
    visible rows only.

---

## Persona red flags

**Alex (power user, HR processing 40 rows):** every one-row commit opens a modal, even
though Undo already exists (AR-7). There are no keyboard shortcuts: no Ctrl+Enter to
commit a row, no `/` to jump to the filter. Impact and Doc lists (≤7 options) have no
type-ahead. Scrolling sideways loses the date (finding 5).

**Sam (keyboard / screen reader):** In/Out/Notes are unnamed (3). The confirm modal
doesn't trap focus or take Esc (2). Toasts may never be announced (10). The table dims
for mouse users but stays editable by keyboard (7). The searchable Combobox goes silent
(11).

**Riley (stress tester):** switching period with drafts loses them silently (4).
Discard All has no undo (6). A failed save leaves no mark on the row (8). The Updated
time may be 5 h off (12).

---

## Ship-worthy quick wins (small, safe, visual/a11y only; no payroll behaviour change)

1. **Name the inputs.** Add an `ariaLabel` prop to `TimeInput` plus `aria-describedby`
   for its error, and pass `In/Out, {name} {date}` from ArRow. Add `aria-label` to the
   Notes input. (Finding 3; touches `TimeInput.tsx` and `ArRow.tsx`.)
2. **Make ArConfirm a real dialog.** Add `role="dialog" aria-modal aria-labelledby`,
   Esc → cancel, and autofocus Confirm. Tidy the copy in the same change: `fmtDay`
   dates, impact dots instead of blue text, "Commit N Rows to Green", no capitals, no ⚠.
   (Findings 1 partial and 2; `ArConfirm.tsx` only, 3.7 KB.)
3. **Sticky date context.** Put the short `fmtDay` date as a second line in the sticky
   Employee cell, so the day never scrolls away. (Finding 5; `ArRow.tsx` only.)
4. **Toast accessibility and timing.** Use always-mounted `aria-live` containers, pause
   on hover/focus, and give Undo toasts 10 s. (Finding 10; `ds/Toast.tsx` only.)
5. **Placeholder contrast.** Combobox empty/placeholder text `slate-400` → `slate-500`.
   (Finding 13; one class in `ds/Combobox.tsx`.)

Next in line, and nearly as small, but they touch hook behaviour, so each needs its own
prompt and test: the revert success toast (9), the discarded-drafts toast on period
change (4), and `inert` during reload (7).
