# Lessons — traps that have actually bitten us

Not general advice. Every entry below cost real time on this project. Read it
before working on GAF HR Hub.

---

## Domain rules that keep resurfacing

### An employee is active if and only if they are in the Current Employees group

Not the Status column. Not "they look active". Group membership on the Panama
Employee Directory board decides it, because a newly added row can have a blank
Status — that is exactly what happened with the rehire.

This has now bitten twice:

1. `syncDirectory` derived `active` from the Status column → fixed 2026-08-19.
2. The "Add unmatched Monday employees?" dialog offered people from the **Past
   employees** group. The code computed `isCurrent` but only used it to *rank*
   rows, never to exclude them → fixed 2026-08-20.

**Before touching anything that reads the Directory board, ask: does this path
filter by `monday_group_directory_current`?** If it doesn't, it's probably wrong.

### A rehire is a new employee

Old row stays in Past employees, new row in Current. Group wins, and the
highest `monday_item_id` breaks ties. Don't try to merge their history.

---

## UIB agent failure modes

### It prunes imports it shouldn't

Twice in one day, removing a feature also removed an import still in use:

- Deleting the FH eligibility chip removed `StatusChip`, still used by the
  Pending badge → `ReferenceError: StatusChip is not defined`.
- Deleting the search debounce removed `useRef`, still called at line 67 →
  `ReferenceError: useRef is not defined`.

Both crashed the whole page with "Something went wrong."

**Mitigation:** when a prompt removes a feature, add a closing line —
*"then confirm every identifier used in the file is imported"*. And always load
the page after a UI prompt; TypeScript-clean is not the same as runs.

### It wraps action params in an extra object

`useLoadAction(action, null, { params: {...} })` instead of
`useLoadAction(action, null, {...})`. The SQL then sees every `{{params.x}}` as
undefined and returns nothing — no error, just silently empty results. Every
breakdown rendered "Nothing recorded or pending" for an employee with 11 days
of PTO.

**Mitigation:** when a new `load*` returns empty, check the call shape against a
working one *before* suspecting the SQL.

**It happened a second time**, in `PtoTable.tsx`, and looked nothing like the
first: `{ params: { year, manager }, enabled: true }`. Only the *year-filtered*
columns broke — WFH, Birthday and FH-used silently read 0 for all 45 employees
while Accrued, Taken and Available were perfect, because those do not use
`params.year`. A partially-correct table is the tell.

**Standing rule:** when one `useLoadAction` is found with the wrapper bug, grep
*every* call site in the feature before moving on. Fixing only the one that was
reported leaves the twin in place.

**It happened a third time**, in `FilterBar.tsx:71` — found 2026-08-25 while
reading the file for an unrelated reason, not because anyone reported it. This
one failed *silently and completely*: `loadActionRequiredCounts` saw NULL, its
`WHERE` matched nothing, `SUM` over an empty set returned NULL, and the render
guard `{tabCount > 0 && ...}` meant the RED and YELLOW tab counts on Action
Required simply never appeared. A feature that renders nothing looks like a
design choice, not a bug — nobody had reported it in months.

`grep -rn "{ params:" src/app` now returns nothing. Run exactly that after any
change that adds a `useLoadAction` call.

### Do not press UIB's "Fix" button

On a runtime error UIB offers Ignore / Fix. Diagnose from the console and write
a targeted prompt instead. "Ignore" is safe — it only dismisses the banner.

---

## Operating the loop

### The export click needs a screenshot between opening the menu and clicking

Open the ⋮ menu on GAF HR Hub → screenshot → *then* click Export. Clicking
straight through frequently just closes the menu, and `sync-export` then reports
"added: 0, changed: 0" for a prompt that really did run. Always confirm a new
zip appeared before concluding nothing changed.

### Verify the clipboard before submitting a prompt

Prompts are pasted, not typed. The clipboard has been clobbered mid-session more
than once — one paste came through as `\O2W-lqEa0-uBnN3`. **Screenshot the
textarea before pressing submit.** Submitting garbage wastes a full cycle.

### Confirm the prompt actually submitted

The panel resizes as it fills, so a submit click at yesterday's coordinates
lands on nothing. Symptom: the last message in the panel is still the previous
prompt's summary. Check before waiting five minutes for a result.

### Don't trust a stale result panel

The query runner keeps showing the previous result while a new query runs. This
caused a wrong conclusion — reading `st=?` from a pre-sync result and telling
the owner the start date hadn't been set when it had. **Confirm the SQL text in
the editor matches the result you're reading.**

### Renderer freezes are normal

`Page.captureScreenshot timed out` happens constantly on the UIB tabs. Wait
10–20 s and retry; it is not a defect. Distinguish this from a real crash by
reading the console.

### Infrastructure errors vs real defects

`Couldn't load details — <action>` on one row that works on retry is
infrastructure — usually connection pressure after a burst of queries. A real
defect is deterministic and reproduces on reload. Add a Retry affordance rather
than chasing a blip.

---

## Data-shape gotchas

### Postgres returns dates as full timestamps

`start_date::text` comes back as `2026-02-02T00:00:00.000Z`, not `2026-02-02`.
Slice to 10 characters. Never construct a `Date` from a date string — use
`fmtDate` for display and plain string comparison for logic.

### The Excel import and the Monday mirror describe the same events

45 Excel-imported PTO rows had no `monday_item_id`, so their Monday requests
still looked pending. Linking them by employee + leave date matched 42 and
dropped Pending from 55 to 13. The remaining 13 had *no* Excel counterpart —
they were requests submitted after the sheet was last updated. **When a count
looks too high, check whether two sources are describing the same thing before
assuming a bug.**

### "No data" is sometimes true

Eight July-2026 hires show zero attendance. The rows exist but none carries a
clock-in time. First hypothesis (email domains) was wrong; the owner said so and
was right. The pattern was the hire date, and the cause is outside the app.
**Check the distinguishing attribute across the whole cohort before naming a
cause.**
