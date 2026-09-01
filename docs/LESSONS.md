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

### On a day off, ask "are there punches?" — never "is there a form?"

**Three incidents, 2026-08-25, 08-26 and 08-27.** The rule now:

- **No punches on a day someone doesn't work → no row.** Not even if a form
  covers the date.
- **Punches on a day they don't work → one YELLOW row showing the real times**,
  with no event type, no pay impact and no discount. An operator decides.

The 08-27 shape is the one to recognise. `permissionCoversDate` is a plain
inclusive string range with **no work-day filter**, so a permission running
Friday→Monday matches the Saturday and Sunday in between. The engine treated
each match as a payroll event and manufactured a YELLOW row with empty Entry and
Exit. Ten reached the queue across four employees; eight were resolved by the
operator before anyone noticed they were fictional.

Three things made it hard to see, all worth remembering:

- **The work-day gate was already there and already correct.** The bug was one
  level in, in what the gate *did*, so every "does it check `work_days`?" search
  came back clean.
- **The tests asserted the wrong rule**, so the suite was green the whole time.
  W2 and W3 had to be rewritten, not added to.
- **A second source existed.** The Teramind-outage branch ran *before* the
  work-day gate, so an outage on someone's day off stamped a GREEN full-day row
  using the schedule's own times. Nothing covered it.

Guarded by `weekendSchedule.test.ts` W2/W3/W9/W11 (behaviour) and
`lessonGuards.test.ts` L5 (structure — the `!tmData` guard cannot be removed or
jumped ahead of).

**And fixing the engine does not clean up.** `upsertPayrollEntries` is
`INSERT … ON CONFLICT DO UPDATE` and never deletes. Rows already written survive
with their discount minutes intact — which is why re-processing after a schedule
change looked like it had worked and hadn't. Since 2026-08-27 a re-run calls
`softDeleteStaleEntries`, but anything outside the re-run's period, date range or
employee set still needs a migration.

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

### Only ever have ONE builder tab open — a second one silently eats a round

**2026-08-27.** The workflow calls for two tabs: one to work in, one to export
from. That is fine only while the export tab stays on a `/dev/…` URL. Loading an
`/edit/…` builder URL in it opens a **second editor session on the same app**,
and the two diverge.

What that looks like, and why the existing checks miss it: the round appears to
succeed, UI Bakery reports the files edited and the imports confirmed, Export
produces **a genuinely new zip** — and `sync-export` says `added: 0, changed: 0`.
The new-zip check above does not save you, because the export really did run; it
just exported unchanged files. The save had been blocked behind a dialog nobody
was looking at:

> ⚠ You have a newer version of your app already saved on the server: …
> **[Overwrite their changes] [Reload from their version]**

**Choose "Reload from their version."** It discards only the edits you can
regenerate from the committed prompt file. "Overwrite" can destroy whatever is on
the server, including someone else's work.

Then close the second tab, re-send the **same prompt in full** rather than asking
the AI to redo it from its own transcript, and export by navigating the *one*
tab back to `/dev/…`. Working this way — one tab, moved between `/edit/` and
`/dev/` — landed every subsequent round first time.

**Add to the per-round checklist: after the run finishes, check for that dialog
before exporting.**

### Verify the clipboard before submitting a prompt

Prompts are pasted, not typed. The clipboard has been clobbered mid-session more
than once — one paste came through as `\O2W-lqEa0-uBnN3`. **Screenshot the
textarea before pressing submit.** Submitting garbage wastes a full cycle.

### Don't paste by clipboard and coordinates — inject the prompt through the DOM

Both halves of the paste-by-hand approach failed on 2026-08-26, silently.

**The clipboard mangles non-ASCII.** `Get-Content -Raw | Set-Clipboard` reads as
ANSI in Windows PowerShell 5.1, so every `—`, `→` and `'` arrives as mojibake.
Prompts 01–04 reached UI Bakery with `LATE â€" UNREPORTED` in them — visible in
the panel afterwards. It never broke a change, because the corruption only hit
decorative punctuation, but it is luck, not design. If you must use the
clipboard, read the file explicitly:
`[System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)`. The length
tells you: 4249 characters via the default encoding, 4215 as real UTF-8.

**Coordinates drift mid-round.** The AI panel resizes as it fills, and the
builder's zoom does not always match the screenshot's coordinate frame. One
click meant for the textarea landed 2 px below it and typed nothing; another
meant for *Export* landed on a different app in the sidebar and navigated away.

**What works, every time:** base64 the prompt file, decode it in the page, set
the textarea through React's native value setter, dispatch an `input` event,
then click `button.submit-message` found in the DOM. Same for exporting — find
the `.menu-item` whose text is `Export` and click that, rather than aiming at a
pixel. Verify the textarea's `.value.length` against the file's character count
before submitting; that check is the whole point and it is free.

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

### A silent UIB logout looks exactly like a very slow prompt

**2026-09-01.** Prompt 07 was pasted, verified at the right character count, and
submitted. The textarea emptied and the placeholder read
`Working on your request...` — every signal the loop checks said the round was
running. It sat there for **eighteen minutes** producing nothing.

The tell, when I finally looked for it: **the prompt itself never appeared in
the panel.** The conversation still ended with the *previous* round's summary,
and searching the panel text for a distinctive phrase from prompt 07 found
nothing. Then both tabs turned out to be sitting on `/auth/login`.

The UI Bakery session had expired. The submit went nowhere, and the panel was
left permanently in its "working" state with no error, no toast, and no timeout.

**Check, as soon as a round runs long:** search the panel for a distinctive
phrase from the prompt you just sent.

```js
const p = [...document.querySelectorAll('div')]
  .filter(d => d.scrollHeight > d.clientHeight + 50 && d.clientWidth < 500 && d.clientWidth > 200)
  .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
/some distinctive phrase from the prompt/i.test(p.innerText);
```

`false` means it never arrived — the placeholder is lying. Re-authenticate and
re-send the whole prompt from its committed file. Do not ask the AI to "continue"
a round it never received.

Related and worth separating: a renderer freeze (`Page.captureScreenshot timed
out`, `Runtime.evaluate timed out`) is normal and harmless during generation. A
freeze *plus* a prompt missing from the panel is a lost round.
