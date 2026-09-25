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

**It happened again on 2026-09-10**, the other way round: a prompt *added* a
`useEffect` to `ProcessPayroll.tsx` and the file's React import only had
`useState, useRef, useMemo`. UIB's lint passed ("TypeScript clean"), the page
crashed. The closing line belongs on prompts that add code too — and the
browser check on `/process` is what caught it, not the tests.

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

Open the ⋮ menu on GAF Panama HR Hub → screenshot → *then* click Export. Clicking
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

### Clicking submit during a run interrupts it — it does not queue

**2026-09-07.** A prompt was pasted and submitted while UI Bakery was still
working on the previous round. Three things happened at once, and none of them
were visible from the placeholder:

- The in-flight run **stopped** (the panel ended `Stopped`).
- The new prompt was **never delivered** — the panel's last user message was
  still the previous one.
- The textarea **kept its text**, so the next paste appended to it and produced a
  doubled prompt.

The length check is what caught it: the third paste measured 18 436 characters
against a 9 218-character file and was not submitted. **Check `.value.length`
against the file before every submit, not just the first**, and re-check after a
failed round rather than assuming the field is empty.

Two related traps from the same session:

- **`ctrl+a` in that textarea can insert a literal `a`** instead of selecting
  all, when the field is already empty. It produced `a# Create ...`, one
  character over. Clear the field by reading `.value.length` back, and if a stray
  character appears, fix it with the native value setter plus an `input` event so
  Angular sees the change:
  `Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(ta, fixed)`.
- **The clipboard really does get clobbered by the human using the machine.** One
  paste arrived as 219 characters because Saul copied something else at that
  moment. Nothing is wrong with the method; re-set the clipboard and paste again.

### An offer to "build the whole thing" must be declined by silence

Same session. After a round that created four actions, UI Bakery ended with
*"Both actions work correctly. Now ready to build the Disciplinary Actions page
— want me to proceed? I'll build the full page with a table, filters,
close/reopen actions…"*

**It then started doing it without an answer**, editing `TopNav.tsx` and
`FilterBar.tsx` before being interrupted. Nothing reached the export — the next
sync read `0, 0, 0` and `git status` was clean — but only because the run was
stopped in time.

That is the bundled change `CHANGE-LOOP.md` warns about, and it would have
ignored the file-size split the design specifies. **Do not reply "no" and do not
reply at all — send the next numbered prompt instead**, and sync straight after
to confirm the offer left nothing behind.

### The Export menu can be driven from the DOM when screenshots die

**2026-09-09.** Late in a long session the Chrome extension's screenshot
capture got stuck on a 184×92 clip (after a `zoom`) and coordinate clicks
became impossible. The ⋮ → Export menu is an Angular overlay that `find` /
`read_page` do not see either. What works, every time:

```js
const link=[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='GAF Panama HR Hub');
const btn=link.parentElement.querySelector('button');
btn.click(); await new Promise(r=>setTimeout(r,800));
const hit=[...document.querySelectorAll('*')].find(e=>e.children.length===0 && e.textContent.trim()==='Export');
(hit.closest('button,a,[role=menuitem],li')||hit).click();
```

Then check Downloads for a new zip, as always. Also: the first ⋮ click after a
navigation opens nothing; hover the app row first, and zoom on the sidebar
before clicking Export, because the Export coordinate lands on another app's
row when the menu is closed.

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

### "Having trouble connecting. Try again." is a dropped stream, not a dead run

**2026-09-10, on nine of eleven rounds.** The AI panel showed
`Having trouble connecting. Try again.` mid-run, sometimes three times in one
round. The run keeps going on the server; only the client stream dropped. The
element is `ubk-message-connection-restore` and its button re-attaches:

```js
document.querySelector('ubk-message-connection-restore button')?.click();
```

Click it inside every poll and the round finishes normally. What does **not**
work: re-sending the prompt while the server run is still alive (UIB then
reports "task already complete" and the export shows the earlier edits), and
reloading the builder tab (it loses the in-flight run). Once the placeholder is
back to `Ask UI Bakery...` and the panel's last message ends in
*Revert to this checkpoint*, export; an export clicked before that line appears
comes back with `changed: 0` because UIB saves at the end of the run.

### A builder tab left open across a release cannot save

**2026-09-10.** The builder tab had been open since before Saul released 6.9.0
at 11:23. The first prompt ran to completion, reported both files edited, and
the export changed nothing. The tab was sitting on *"You have a newer version
of your app already saved on the server: Sep 10, 11:23 by Saul — Overwrite /
Reload from their version"*. Same trap as the second-editor-session one above,
different trigger: a **release** bumps the server version too. Check for the
dialog before the first prompt of a session, not only after a round:

```js
!![...document.querySelectorAll('button')].find(b => /Reload from their version/i.test(b.textContent) && b.offsetParent)
```

(`document.body.innerText` also matches the dialog's hidden template text, so
test the button's `offsetParent`, not the text.) Choose *Reload from their
version*, then re-send the prompt in full.

### `title=` on an SVG element is not a tooltip

**2026-09-10.** Every ⓘ in the app (Contracts, PTO, Disciplinary) had its
`title` on the lucide `<svg>`. Browsers only render the HTML `title` attribute
on HTML elements; an SVG wants a `<title>` child. Saul's report was "tooltips
are there but not showing anything". `InfoTip` now wraps the icon in a `<span
title>`. Screenshots cannot verify a native tooltip (it is drawn by the OS
outside the page), so the check is the DOM: the title must sit on an HTML
element.

---

### UIB's editor drops characters from long string literals

**2026-09-11.** A 6192-character base64 logo was written three times and came
out 3067, then 3089, then 6191 characters long — once with a single `7`
missing in the middle. Lint passed every time (the file is valid TypeScript);
only the image was blank. Below ~3.5 KB a literal survived intact. Split long
literals into ~1.5 KB parts joined at load time, state each part's exact length
and last characters in the prompt, and **byte-compare the export against the
source** before committing — a length check alone would have passed the
6191-character version. When one character is missing, ask for that one
insertion (context + character), not a rewrite.

---

### A presence-based "dirty" flag never clears itself

**2026-09-11.** Payroll Master decided a row had unsaved changes by asking
"is there an entry in `edits` for this id?" — and `handleSave` never removed
that entry after writing. So the Save button stayed forever, the green ✓ was
unreachable, and a second click was a silent no-op. It had been that way since
the first commit; Saul reported it as "seems saved but the button keeps
showing". Two rules came out of it: a dirty flag compares the draft against
the loaded row (never mere presence), and a successful save calls
`markSaved(id)` from `useRowEdits`, the one shared place drafts live.
Guarded by `lessonGuards.test.ts` L6 and `punchWiring.test.ts` PW5.

### A save path that skips the engine writes stale minutes

**2026-09-11.** Editing Entry or Exit saved the two strings and nothing else.
`late_minutes`, `late_after_grace` and `early_leave_minutes` stayed whatever
the engine had computed from the *old* punches, and the discount and status
were then derived from those stale numbers. Luis Abad's 6/1 exit went from a
cross-midnight "12:35 AM" to "4:00 PM" and Early stayed 985. The only
minutes-from-punches formula lived inline inside `runClassificationEngine`.
Now `punchMinutes.ts` holds it as a pure function, both grids recompute on
every save through `updatePunchTimes`, and `punchMinutes.test.ts` PM6 runs the
real engine and asserts the helper agrees with it. **When a page writes one
half of a derived pair, ask who writes the other half.**

Two neighbours found on the way: `TimeInput` threw on `12:35am` (no space)
and the raw text was saved as typed (`parseTimeInput.test.ts` TI1); and a
Teramind session that crosses midnight makes the engine read the exit as
00:35 and charge 985 early minutes — the helper treats exit-before-entry as
past-midnight, the engine now agrees (prompt 08, `crossMidnight.test.ts` CM1–CM2).

---

## Data-shape gotchas

### The same period run twice under two names is invisible until something joins on the name

**2026-09-10.** `Q1-Aug-2026` was run, stopped part way, and re-run an hour
later as `Q1-Aug-20260`. `upsertPeriod` is keyed on the name, so the second
run got its own `periods` row and the first run's 205 payroll rows became
orphans — no `periods` row, no dropdown entry, no page that could show them.
For a month every screen agreed with itself. The PTO tracker's new In-payroll
column was the first thing to *join* `payroll_entries` to `periods` by name
in a per-employee view, and Gabriel Chu's floating holiday listed two cycles.

Two rules came out of it: the period name is validated before a run
(`src/app/lib/periodName.ts`: trimmed, canonical shape, near-miss of an
existing name refused), and `periods.period_name` has a `NOT VALID` CHECK so a
bad name fails even if the UI is bypassed. **When a table is keyed by a
human-typed string, a near-duplicate is a silent fork, not an error.**


### A count of records is not a count of days

**2026-09-09.** Charles Bush recorded two floating-holiday days as one row and
the tracker showed **FH left 1**. `fh_used` was `count(*)` over recorded
`floating_holiday` approvals — a design decision written into the 08-20 spec,
correct for "one row = one day" and silently wrong the moment an operator
enters a two-day row. Nothing errored; the number was simply one too low.

Twin trap on the same column: the August Excel seed wrote 2026 FH usage into a
*separate counter* (`pto_floating_holidays.fh_used`) that no approval row backs,
so 26 people showed "FH left 2" while the sheet said they had used them. Two
sources, disjoint sets, one displayed number.

**Whenever a KPI sums records, ask what a record of size 2 does to it.** Guarded
by `loadPtoBalancesInputs` now using `SUM(total_days)` and the sheet counter
via `GREATEST`; the FH-left tooltip shows both sides so the operator can see
which one won.

### "Withdraw" that hides is indistinguishable from delete

Withdrawn PTO rows were a soft status but hidden behind a checkbox that only
affected the *expanded* sub-table, and the Monday request then reappeared as
Pending. Saul's reading: *"if I withdraw something it literally disappears
forever."* When an undo exists but is not visible at the point of loss, it does
not exist for the user. Withdrawn rows now stay in place, dimmed, with Restore.


### Postgres returns dates as full timestamps

`start_date::text` comes back as `2026-02-02T00:00:00.000Z`, not `2026-02-02`.
Slice to 10 characters. Never construct a `Date` from a date string — use
`fmtDate` for display and plain string comparison for logic.

**Re-confirmed 2026-09-07, with the mechanism.** The `::text` cast is not
ignored — the driver re-serializes the result back to a timestamp on the way
out. So `document_date::text AS document_date` still arrives as
`2026-06-24T00:00:00.000Z`. **Casting is not a substitute for slicing at the
point of use**, and any spec that says `::text` keeps timestamps away from the
client is wrong. Keep the cast anyway (it costs nothing and documents intent),
but every consumer still slices. The trap is a string comparison that looks
safe: `'2026-10-07T00:00:00.000Z' <= '2026-10-07'` is **false**, because the
longer string sorts after — so an unsliced `<=` silently drops the boundary
day.

**Third time, 2026-09-07, and the worst symptom yet.** The Attendance Reports
tab rendered *every day for every employee* as an unexplained absence — 440
absent, 0 on-time, 45 people. Nothing threw. Nothing logged. The page looked
finished. `loadPeriods`, `loadHolidays` and `employees.start_date` all hand back
ISO timestamps, and a date built from them never equals the plain `YYYY-MM-DD`
the loop compares against.

**The fix that finally holds: normalise at the boundary, not at each call
site.** Patching one query moves the failure to the next one — the first attempt
rewrote three actions to use `TO_CHAR(..., 'YYYY-MM-DD')` and the page was still
wrong, because `loadPeriods` was not one of the three. `attendanceReport.ts` now
slices every incoming date once, where the input is indexed, so it cannot matter
how any caller wrote its SQL. Guarded by `attendanceReport.test.ts` R43–R45 and
R47, which feed the module ISO timestamps directly.

### A BIGINT can arrive as a string, and a missed lookup looks like real data

`employees.id` and `payroll_entries.employee_id` are both `BIGINT`. Depending on
the query, one can arrive as the number `1` and the other as the string `"1"`.
A `Map` keyed by one and read by the other misses **silently** — and in a report
that joins punches to employees, a missed punch does not render as an error, it
renders as *an employee who did not come to work*.

Key every index by `String(id)` and read it the same way. Guarded by
`attendanceReport.test.ts` R46.

The general shape of both traps: **an absent lookup and an absent fact are
indistinguishable on screen.** Whenever a missing join result would render as a
meaningful business value rather than as a blank, normalise the key type at the
boundary and write a test that feeds the function what the database actually
returns rather than what the type says it returns.

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

### The feed someone else already uses is not evidence that it is the right feed

**2026-09-17.** The Teramind integration was first built on the `login_session` analytics feed,
because the VP's Work Pattern Monitor used it and a three-day spot check on one employee matched
payroll to the minute. The comparison screen then showed **33%** agreement over a whole period:
people stay logged in for days, so most days have no "login" at all, and some sessions are eight days
long. Saul asked one question — "when I open Time Records in Teramind I see today's earliest
session" — and that screen's own network call (`POST /tt/r/time-records/grid`) turned out to be
reachable through our datasource: live, filterable, exact, **96–99.6%** agreement.
Rules: (1) a spot check on one tidy employee proves nothing — build the whole-population comparison
*before* trusting a source; (2) when replacing a manual step, start from **the screen the human
actually exports from** and read its network traffic, not from whatever API a neighbouring app calls.

### UIB rewrites date-looking TEXT on its way to the browser — on the way out only

**2026-09-17.** `teramind_pull_log.date_from` is `TEXT` holding `2026-08-10`; the browser received
`2026-08-10T00:00:00.000Z`. Same family as "Postgres returns dates as full timestamps", but it
happens to TEXT columns too, so a stored `YYYY-MM-DD HH:MM:SS` wall-clock string cannot be trusted
to arrive unchanged. For anything where an hour matters (payroll punches), **return integers**
(`YYYYMMDD`, minutes since midnight) and rebuild the text in a tested lib; for dates, slice to 10.

### Inside UIB the code root *is* `src`

**2026-09-17.** A prompt saying "create `src/app/lib/x.ts` exactly" produced a stray top-level
`src/` folder (exported as `src/src/app/lib/`). Earlier prompts got away with it because UIB's AI
usually maps the path; "character for character" made it literal. Every prompt now opens with a
two-line note that mirror paths drop the leading `src/`, and the export diff catches the rest.

### When the clipboard is unavailable, load the prompt from localhost

**2026-09-17.** Under a remote-control session every Windows clipboard call failed
("Requested Clipboard operation did not succeed"). Working alternative: serve the prompts folder
with a ten-line Node server on `127.0.0.1` (CORS for the UIB origin +
`Access-Control-Allow-Private-Network: true`), then in the builder tab `fetch` the file, set the
textarea through the native `HTMLTextAreaElement` value setter and dispatch an `input` event.
Check `.value.length` and a few distinctive substrings **before** clicking submit, and afterwards
confirm the chat's last heading is your prompt's title. Angular picked the value up every time.

### PowerShell double-encodes `·` and `—` even when the source is UTF-8

**2026-09-18, twice in the same session.** `Get-Content`/`Set-Content`, and `Get-Content -Raw`
piped onward, both re-encode through Windows PowerShell 5.1's default (ANSI) codepage unless told
otherwise — even when the file on disk is already valid UTF-8. The visible symptom is the same
mojibake as the clipboard trap above (`·` and `→` come out garbled), but the cause is different:
no clipboard was involved either time. **Use `[System.IO.File]::ReadAllText($p,
[Text.Encoding]::UTF8)` to read and `[System.IO.File]::WriteAllText($p, $text, [Text.Encoding]::new($false))`
(the `$false` suppresses the BOM) to write** — never PowerShell's own `Get-Content`/`Set-Content`
for a docs file containing these characters. Re-read the file after writing it whenever a
special character is present; that's the whole check and it's free.

### The redeploy window looks exactly like a broken page

**2026-09-18.** For roughly 1–2 minutes after every prompt finishes, `/dev` returns 500 "Unknown
error" on every single DB call while UI Bakery redeploys the draft build. Loading the page during
that window and seeing every panel error out looks identical to the prompt having broken something.
**Never judge a page inside that window.** Wait it out (10–20 s poll, same tolerance as the
renderer-freeze lesson above) and hard-refresh before concluding anything, good or bad.

### `document.hidden` is true whenever the tab sits behind another window — test it directly, don't minimize

**2026-09-18.** `MondayAutoSync` (like the Teramind auto-sync before it) refuses to run while
`document.hidden` is true, by design — it must only run for a super user actively watching the Hub.
The obvious way to test "does it correctly skip when backgrounded" is to switch to another window,
but that makes Chrome report the tab hidden too, so the sync correctly does nothing — which is
indistinguishable on screen from a sync that is simply broken. **Override the property directly on
the page's own document instead of changing what's on screen:**
```js
Object.defineProperty(document, 'hidden', { get: () => false });
document.dispatchEvent(new Event('visibilitychange'));
```
Flip it back to test the skip path. Neither direction requires touching the actual window focus.

### Prompt acceptance must name the exact visible outcome, not the feature

**2026-09-18.** Prompt 01 asked for a `No Reports Yet` amber chip when a scheduled person has no
activity and no form. The first round rendered *no chip at all* for that case — UIB had generalized
an earlier "no chip for a normal worked day" instruction to cover this case too. The acceptance line
in the prompt read "the Why column works", which the empty render technically satisfied (it didn't
crash, other chips showed correctly). Rewriting the acceptance line to name specific people and the
literal expected chip — "Navvad and Timothy show No Reports Yet" — is what caught it, in prompt 01b.
**Every UIB prompt's acceptance criteria should name a specific visible fact (whose row, what label,
what color), never a description of the feature working.**

### Never `window.location.reload()` inside the app

**2026-09-18.** Activity's Retry button called `window.location.reload()`. Inside UI Bakery the page
lives in an iframe on a URL that is not directly routable, so a reload 404s instead of refreshing the
data. Refetch through the data layer instead. Guarded by `T16` in `tests/lessonGuards.test.ts`: no
`location.reload/assign/href=` under `src/app/pages`.

### Release to staging first, and do FULL page reloads there — in-app navigation hides a startup burst

**2026-09-18.** 8.1.0 looked clean under normal use, but a full page load fires nine queries at once
on startup, and under that burst one intermittently failed. In-app navigation never re-fires all nine
together, so nothing caught it until staging was loaded cold, repeatedly, with full reloads — not
clicks between tabs. The three background syncs' first run was pushed 20 s after load to spread the
burst out, verified with four clean full reloads before promoting to prod.

### When "any loader error blanks the page" is introduced, add a retry in the same change

**2026-09-18.** Prompt 12 made a failed activity load show only an error, never a false "No Records"
for everyone — correct, because the old behavior silently lied. But without a retry, a transient
500 (the kind the redeploy window and connection-pressure lessons above already describe as routine)
now blanks the whole page for every viewer until they refresh by hand. Prompt 13 paired the stricter
error handling with one guarded automatic retry in the same change, so a transient blip stops looking
like an outage.

### A status judged against the wall clock turns stale data into an accusation

**2026-09-18, on prod.** Today's tiles read "0 Working / 38 Away" — every employee marked absent —
because the underlying sync copy was 21 minutes old and the status logic compared it to the current
wall clock instead of to the data's own timestamp. Nothing was wrong with attendance; the number was
stale, not zero. Prompt 14 judges Today's statuses as of the last data update and adds an amber notice
when that copy is more than 25 minutes old, so staleness reads as staleness rather than as a business
fact.

### Batching prompts into one export only works when the file lists are disjoint — and still needs checking

**2026-09-18.** Several of the afternoon's prompts (07–14) were combined into single exports where
their target files did not overlap. That is fine, but only because each prompt's file list was
checked against the others before sending, and `git status --short` after export was still compared
against the *union* of everything allowed. Skipping either check is what makes batching risky — it
looks identical to a clean single-prompt export until two prompts happen to touch the same file.

### Accept an unasked-for file split when it's the 15 KB rule doing its job

**2026-09-18, twice.** Two rounds came back having split a file (`FilterBar.tsx` →
`AttendanceRangeControls.tsx`; the employee panel → frame + body + Day By Day) without being told
to. Neither prompt asked for a split. Both were still the right call: the untouched file was
heading toward or past the 15 KB ceiling, and the split is exactly what `CLAUDE.md`'s file-size rule
exists to produce. **Don't revert a UIB-initiated split just because it wasn't requested — check the
resulting file sizes and whether behavior held (screenshot before/after), accept it, and say so
plainly in the commit message** so a later `git log` read doesn't mistake it for scope creep.


### Never link the nav to a route that redirects — the workbench fights it and the app loops

**2026-09-22, on prod, reported by Saul as "Today flashes like a redirect issue and then gets messed
up".** The Attendance section's nav target was `/attendance`, and that route rendered
`<Navigate to="/attendance/today" replace />`. UI Bakery's workbench mirrors the running app's URL:
about 40 ms after any `replaceState` it writes its own remembered value back and fires a `popstate`.
React Router then re-rendered `/attendance`, our redirect fired again, and the two took turns.

Measured in the iframe with patched `history.pushState`/`replaceState`: **448 history operations and
~250 database requests in roughly two seconds** per click, ending on `/attendance` — which rendered
the *List* tab with no tab highlighted, while the backlog of queries made every later page crawl
until a hard refresh. The console showed no error at all; the only visible symptom was a flash and a
slow, wrong page. Two things made it hard to spot: a **full page load is fine** (the workbench has no
remembered URL yet to overwrite), and clicking the **Today sub-link is fine** (no redirect involved),
so it only reproduces on an in-app click to a redirecting route.

**The rule: a route the app navigates to must render its page, not redirect to another route.**
`/attendance` now renders Today directly, and `TopNav`'s section home, `homeFor()`, `RequireSuper`
and the "view as" button all point at `/attendance/today`. Guarded by L7 in
`tests/lessonGuards.test.ts`. The same trap applies to any future `<Navigate>` on a landing route —
and to a `setSearchParams(..., { replace: true })` that runs on every render.

### Read the whole element before claiming a file is missing something

**2026-09-22.** Right after fixing the Activity tables' frozen headers, I told Saul that Contracts,
PTO Tracker and Disciplinary "have the same flaw", got his approval, wrote a prompt and sent it. All
three already had `max-h-[calc(100vh-260px)]` on their `<DataTable>` and their headers already froze.
UI Bakery read the files, refused to change anything and was right; the export came back 0/0/0.

The cause was a truncated look: `grep -n "<DataTable" -A 5` printed `columns`, `sortKey`, `sortDir`,
`onSort`, `stickyHeader` — and stopped one line before `className`. Five lines looked like the whole
element. **When the claim is "this file lacks X", read the whole element (or grep for X itself)
before saying it out loud** — especially before asking Saul to approve work based on it. The cost
here was small (a wasted round trip and a wrong statement to him), but the same habit is what turns
into a confident wrong diagnosis on something that moves money.

### A guard that rejects typos must be tested against the next real input, not only against typos

**2026-09-23.** The period-name guard (Sep 10) caught `Q1-Aug-20260` as a typo of `Q1-Aug-2026`, which was its job. It also caught **Q2-Sep-2026** as a typo of Q1-Sep-2026, because any one-character difference counted, and Q1/Q2, Jun/Jul, Mar/May and 2026/2027 all differ by one character. The Sep 22 session verified that `nextPeriod` pre-filled Q2-Sep correctly and did not run the guard on that pre-filled name. Nobody hit it for two weeks because Q2-Sep was the first Q2 created after its Q1 since the guard went in. **When adding a rejecting check, add a test that the next legitimate value passes** (here: the name `nextPeriod` produces, with only the previous period existing). The fix removed the need to type at all: the name now comes from the end date.

## Release publishes the whole draft, not just today's work (2026-09-24)

Releasing the Hub for the disciplinary edit (8.12.0) also shipped the write-locks from 09-23,
which were sitting in the draft "not yet released". Before pressing Release, run
`git log` since the last release note in the newest HANDOFF and list every unreleased change to
Saul, not only the current one. Also: clicking Release on the Hub freezes the builder tab for
about a minute while the panel loads; wait, don't click again. And the ⋮ → Export click missed
twice and opened another app instead; find the ⋮ button with `find` and click it by ref.

## UIB's AI can compact its context mid-prompt and then improvise (2026-09-25)

A 21 KB prompt (AR-2) came back with a forbidden `app.tsx` edit and a hand-written page instead
of the supplied file; its panel showed "Compacted context" partway through. It had re-derived the
change from the prose. **Guard:** keep prompts small, open each with an explicit copy-exactly rule
("do not re-derive from the description; if your context is compacted, re-read this prompt"),
and order changes compatible-first (new or backward-compatible files, then the switch-over), so a
bad run never leaves the page broken. Always byte-compare the export against the supplied code.

## The Windows clipboard can be locked by another app (2026-09-25)

`Set-Clipboard` failed repeatedly mid-session. Workaround: serve `docs/superpowers/prompts` from a
tiny local CORS server on `127.0.0.1:8765` and `fetch()` the prompt from the builder tab, set the
textarea with the native value setter plus an `input` event, then compare lengths before sending.

## Rebuilding a big table on every save looks like a crash (2026-09-25)

Payroll Master swapped its whole table for "Loading…" on each `reload()`: 444 rows, 2,223 selects,
28,458 options rebuilt, tab frozen for over a minute. Tim reported it as "Save crashes". Keep
tables mounted while reloading (`useLoadAction` keeps the previous data); show a full spinner only
on the first load, and dim + block clicks during later reloads.

## Never build prompt files with an unquoted heredoc (2026-09-25)

`cat <<EOF` (unquoted, used to interpolate a variable) runs every backtick span as a command.
A prompt line with `` `AT TIME ZONE 'America/Panama'` `` executed Windows' `AT` scheduler (it only
printed "Invalid command"; nothing was scheduled) and pasted its help text into the prompt. Use
`<<'EOF'` for prose and append variables separately, and grep the generated prompt before sending.
