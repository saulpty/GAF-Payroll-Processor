# Project B backlog

Things found but deliberately not fixed yet. Each gets its own design → plan →
build cycle through the loop in `CHANGE-LOOP.md`.

Ordered by risk to payroll correctness, not by effort.

---

## Confirmed issues

### 1. Full-day absence discount differs by 60 minutes depending on code path

> **RESOLVED BY OWNER, 2026-08-11: 480 minutes (8h) is the correct policy.**
>
> No employee was under-paid. The 480 that has actually been applied is right;
> the 420 in `full_day_absence_discount_minutes` is the wrong number, and the
> app has been misrepresenting its own behavior rather than miscalculating it.
>
> This inverts one part of the finding below: the single path that *does* read
> the config — the no-data/no-form case at `classificationEngine.ts:654` —
> applies 420 where policy is 480, so those rows are **under**-docked by an
> hour. They are flagged RED for operator review, so the error is visible
> rather than silent, but it is still wrong.
>
> **The fix is therefore twofold:** set `full_day_absence_discount_minutes` to
> 480 so the config states the truth, *and* thread it through the call sites
> listed below so the value is genuinely configurable rather than
> coincidentally correct. Doing only the first leaves the same trap for the
> next person who edits that setting and sees nothing change.

**Where:** `src/app/lib/classificationEngine.ts:234` (hardcoded default),
`:243` (`computeDiscount` signature), `:295` (`computeDerivedFields`
forwarding), `:550-582` (Step 2, full-day permission — auto-resolves GREEN),
`:654` (the one place the config value is actually used), `:802` and `:837`
(the engine's own two call sites); `src/app/pages/PayrollMaster.tsx:208`,
`:286`, `:709-719`; `src/app/pages/ActionRequired.tsx:215-229`.
**Risk:** medium — no employee was under-paid (see the resolution above), but
the config setting does not do what it says, and the one path that honors it
now applies the wrong number. Fix before anyone touches that setting.

`classificationEngine.ts:234` defines `FULL_DAY_DISCOUNT_MINUTES = 480`
(8h), the default for `computeDiscount`'s second parameter (`:243`),
forwarded by `computeDerivedFields` (`:295`). The DB-editable
`full_day_absence_discount_minutes` config key defaults to 420 (7h —
`:326`/`:333`/`:347`) and is meant to be the actual policy value.

`grep -n "computeDerivedFields(\|computeDiscount(" -r src` shows every call
site in the app — `classificationEngine.ts:802` and `:837` (via
`buildEntry`), `PayrollMaster.tsx:208`, `:286`, `:710`, and
`ActionRequired.tsx:215` — omits the second argument. **None of them ever
passes the configured value.** The only place `full_day_absence_discount_minutes`
is used at all is a direct field assignment, `entry.discount_total_minutes =
cfg.full_day_absence_discount_minutes` (`:654`), which bypasses
`computeDiscount` entirely and applies only to the narrow "no Teramind data +
no absence form" case.

It is worse than an edit-time mismatch: Step 2 of the engine (`:550-582`)
auto-classifies an approved unpaid-leave/LWOP/"Permiso No remunerado"
request as `pay_impact_1: 'Unpaid'`, `initial_status: 'GREEN'` — already
`payroll_ready`, no operator ever reviews it — and its discount comes from
`buildEntry` → `computeDerivedFields` (`:837`, no second argument) → the
480-minute default. Every ordinary full-day unpaid-leave day is discounted
480 minutes, not the configured 420, with nobody ever asked to confirm it.
`ActionRequired.tsx:215` and `PayrollMaster.tsx:208`/`:286` have the
identical gap on their save paths, so resolving a YELLOW/RED row the same
way re-locks in 480. `PayrollMaster.tsx:719`'s live-recompute comparison
(`liveDiscount !== row.discount_total_minutes`) surfaces the symptom: rows
can be highlighted as edited when nothing was touched, because the live
480 disagrees with whatever 420-or-480 value was last stored by a
different path.

The comment on `classificationEngine.ts:234` ("cfg overrides this at
run-time") is not accurate for any of these paths — config is consulted
only by the single no-data/no-form fallback at `:654`, and even that value
gets overwritten back to 480 the next time the row is saved through
`ActionRequired.tsx` or `PayrollMaster.tsx`. Fixing this means threading
`cfg.full_day_absence_discount_minutes` into every call site listed above —
but confirm with the owner which number is the correct policy before
changing anything; 480 appears to be what has actually been applied to real
unpaid-leave and LWOP days, silently, for as long as this config key has
existed.

### 2. `resolved_by` is an inert guard
**Where:** `src/migrations/1781189300_gaf_planilla_initial.sql:119` (column
created); used as `resolved_by IS NULL` in seven already-applied data-repair
migrations — `1781401100`, `1781401200`, `1781401400`, `1781401500`,
`1781401600`, `1781401700`, `1781401800`.
**Risk:** confirmed — those seven migrations may have silently overwritten
rows an operator had already resolved by hand. Not reversible from here;
matters going forward.

`grep -rn "resolved_by" src/actions/ src/app/` returns nothing — no code,
past or present, ever writes to this column. `resolved_by IS NULL` is
therefore always true, regardless of whether an operator had actually
resolved the row by hand, so each of the seven repair migrations touched
every matching row, including any an operator had already corrected by
then. The guard protected nothing.

All seven have already run; there is no way to reconstruct from the data
alone which rows, if any, were operator-resolved at the time and got
overwritten. This is a closed, retrospective risk rather than an action
item today — but any future data-repair migration must not rely on
`resolved_by` as a safety predicate unless something starts writing it
first.

### 3. Monday.com IDs are still hardcoded in two places — ✅ FIXED 2026-08-18 (`d508e66`)

> **Phase 2 done.** The Directory sync now lives in
> `src/app/pages/admin/employees/MondayTab.tsx` and reads every board and
> column ID from `classification_config` with no fallback; a missing key shows
> a red banner naming it and disables the sync. Monday is called only through
> `pullMondayBoard` with the whole query as `params.query`, which is the
> known-good pattern the 2026-08-11 attempt got wrong.
>
> Verified against live data rather than assumed: a real sync updated 6 rows,
> and `employees.manager` holds names, not emails — the exact signature of the
> original incident. Spot-checked Yessenia Moran/Mendel Silverman, Ulla
> Hees/David Sallusti, Tanya Bedoya and Sarah Mora/Cheyenne Pelis against the
> board.
>
> `AdminEmployeeSync.tsx` and `loadEmployeeDirectory.ts` were deleted in
> `ba5a1f8`, which removed the last hardcoded IDs from the codebase. Tests H4
> and H5 in `tests/hardcoding.test.ts` now fail the suite if any Monday board
> or column ID is written into code again, or if those pages come back.

> **Historical record of how this got here, kept because the failure modes recur.**
>
> Writing this up revealed the backlog entry was dangerous as originally
> stated. "Read the IDs from config instead of hardcoding" would have broken
> the sync, because the config was wrong: `monday_board_directory` held the
> superseded `8661565945`, `monday_col_directory_role` held the literal
> string `text` (a column *type*, not an ID), `monday_col_directory_manager`
> was empty, and the active and email columns had no keys at all. The sync
> would have searched for a column named `text` and a manager named
> empty-string — blank roles and managers, no error.
>
> Migration `1781803400_fix_monday_directory_config` corrects all five and
> is verified in the live database. Nothing reads these keys yet, so it
> changed no behavior.
>
> **Phase 2 attempted 2026-08-11 and reverted.** The refactor itself was
> good — `dirCfg` correctly threaded into `parseMondayDirectory` as a
> parameter, all four column IDs config-driven, warning banner added, clean
> two-file diff, 69 tests passing. It failed on one detail: the action put
> `{{params.boardId}}` **inside a quoted string** in its body template. UIB
> substitutes `{{params.…}}` as a whole value, not within a string, so the
> placeholder reached Monday.com verbatim and GraphQL returned
> `PARSING_ERROR`. Directory Sync returned zero employees.
>
> Reverted via UIB's checkpoint. Never released, so users were unaffected,
> and the change never entered git — after the revert the export synced back
> byte-identical to the last good commit.
>
> **The known-good fix**, for whenever this is retried: pass the *entire*
> query as one parameter, exactly as `src/actions/pullMondayBoard.ts` does —
> `body: \`{ query: {{params.query}} }\`` in the action, with the page
> building the query string from `dirCfg.boardId` and passing
> `{ query: dirQuery }`. Do not interpolate inside a string literal.
>
> Also unresolved from that attempt: user-visible copy at
> `AdminEmployeeSync.tsx:426` and `:696` still hardcodes
> `color_mkyjv6et`, `text_mm63b2xk` and board `8592460836` in text shown to
> the operator. Same defect class as the mid-day checkbox label — the copy
> will lie if config ever changes. Fold this into the retry.
>
> Board `8592460836` confirmed correct by the owner on 2026-08-11, which
> means migration `1781400400` wrote a wrong board ID into config.


**Where:** `src/actions/loadEmployeeDirectory.ts:14` (board id);
`src/app/pages/admin/AdminEmployeeSync.tsx:68,71,73,76` (four column ids).
**Risk:** confirmed — the same failure mode that previously caused wrong
manager matches; `classification_config` is not the single source of truth
it is meant to be.

`classification_config` seeds `monday_board_directory` at 8592460836
(migration `1781400300`), then corrects it to 8661565945 (migration
`1781400400`, "based on confirmed board"). But
`loadEmployeeDirectory.ts:14` still hardcodes the GraphQL query body with
the original, superseded id: `"{ boards(ids: [8592460836]) ... }"`.
`AdminEmployeeSync.tsx` never reads `classification_config` at all — it
hardcodes four Monday column ids directly in its parser: `color_mkyjv6et`
(active status, line 68), `text_mm63b2xk` (role, line 71),
`text_mkzj84w1` (manager, line 73), `text_mkzjgsxv` (employee email, line
76). If any of these change on the Monday.com side — or, as already
happened once with the board id, get corrected in config but not in code —
the directory sync silently reads the wrong board or column and produces
wrong role/manager/active data with no error. That is the exact precedent
this failure mode already set.

### 4. `midDayPullDate` is derived from the clock, not the data — ✅ FIXED 2026-08-11 (`63afa19`)

> A `teramindMaxDate` memo now derives the pull date from the uploaded rows,
> falling back to today only when none are loaded. Date taken as the text
> prefix of the timestamp — no `Date` construction, no timezone conversion.
>
> Second test of the loop, and a more demanding one than the label fix: real
> logic, in the 53 KB file, with a deliberate trap (an instruction not to
> tidy the duplicated `Coverage:` computation at lines 640-645). UIB changed
> one file, respected the trap, and its chat opened with *"Reading AGENTS.md
> and the relevant file sections first"* — the first direct evidence the
> standing instructions are being read.
>
> One nit, not a defect: the memo was placed at line ~503, below its use at
> line ~427. Legal — `runEngine` only executes after render — but it reads
> awkwardly. Worth tidying whenever that area is next touched.

**Where:** `src/app/pages/ProcessPayroll.tsx:427`
**Risk:** low today — confirmed 2026-08-11 that payroll is always processed the
same calendar day as the pull.

The mid-day pull backfill fires only when the day being processed matches
`midDayPullDate`, which is computed as `new Date()` at *processing* time rather
than the date the Teramind data was actually pulled. Those agree only when both
happen on the same calendar day.

If a pull at 1 PM were ever processed after midnight, the backfill would not
fire and **every employee would show a 240-minute discount** on that day.

The fix already exists in the same file: `ProcessPayroll.tsx:641-644` computes
the maximum date across the uploaded Teramind rows for the "Coverage" label.
That value *is* the pull date and should feed `midDayPullDate`.

Covered by tests `H2` and `H2b` in `tests/hardcoding.test.ts`.

### 5. The mid-day pull checkbox label is wrong — ✅ FIXED 2026-08-11 (`9b6f033`)

> Now reads `— fills missing exits with each employee's scheduled end`.
>
> This was the first change made through the export/diff loop with
> `AGENTS.md` in place, chosen as a deliberate test: a one-line display edit
> inside `ProcessPayroll.tsx`, the project's largest file at 53 KB and its
> highest-blast-radius target. UIB changed exactly that one line — 1 file,
> 1 insertion, 1 deletion — and touched neither the checkbox behavior nor
> `classificationEngine.ts`. 69 tests still passing.

**Where:** `src/app/pages/ProcessPayroll.tsx:659`
**Risk:** none to numbers; misleads the operator.

The label reads `— assigns 4:00 PM default exit`. The engine assigns each
employee's DST-aware *scheduled* end, not a fixed 4:00 PM. A hardcoded 4:00 PM
is the exact defect test `H2` was written to prevent — the behavior was fixed
and the label never updated.

### 6. Timezone seam between Teramind dates and machine-local dates
**Where:** `src/app/lib/teramindParser.ts:179-188` vs
`src/app/lib/classificationEngine.ts:496-511`
**Risk:** latent.

Teramind exports carry US Eastern wall-clock times and are parsed without
conversion, so date keys are Eastern calendar days. `pullDate` is derived from
the machine's local calendar day (Panama, UTC-5, no DST). During US DST these
disagree between 11 PM and midnight local.

Harmless for the current mid-day-pull use, but this is the same class of bug as
the ten timezone migrations already in the history. Belongs in `AGENTS.md` as an
invariant so it stops being reintroduced.

### 7. Period count mismatch
**Where:** observed in the browser console on the Summary dashboard.
**Risk:** unknown — not yet investigated.

`loadSummaryAllPeriods` returns 11 rows while `loadPeriods` returns 10. May be
a legitimate aggregate row, may be a duplicate or orphaned period.

### 8. Config keys shown in the admin UI but read by nothing — two, not four
**Where:** `src/migrations/1781272800_add_classification_config.sql` (seeds
four keys); `src/migrations/1781274800_cleanup_obsolete_config_keys.sql`
(already deletes two of them); `src/app/lib/classificationEngine.ts:337-349`
(`buildClassificationConfig`, the only reader of `classification_config`).
**Risk:** none to payroll numbers — operator UX confusion only, and a
smaller problem than first reported.

`grep -rn "tft_late_red_threshold_minutes\|grace_pardon_requires_form\|grace_excess_split_event\|no_data_no_form_impact" src/actions/ src/app/`
returns nothing: none of the four keys is read by any action or page.
`buildClassificationConfig` (`classificationEngine.ts:337-349`) only ever
reads `non_grace_auto_resolve`, `non_grace_auto_impact`,
`early_leave_auto_impact`, and `full_day_absence_discount_minutes`. So
"read by no code" holds for all four.

But "shown in the admin UI" does not hold for two of them.
`1781274800_cleanup_obsolete_config_keys.sql` — applied 2026-06-12 per
`applied.txt` — already `DELETE`s `grace_pardon_requires_form` and
`grace_excess_split_event` from `classification_config`, specifically
because "grace behavior [was] confirmed by business owner" and hardcoded
instead. No later migration re-inserts either key. So as things stand,
only `tft_late_red_threshold_minutes` and `no_data_no_form_impact` are
still seeded rows that Admin → Rules & Config can display and an operator
can edit to no effect — the other two were already cleaned up. Correct
count: **two** dead-but-visible config keys, not four.

---

## Structural

### 9. Six files are too large to edit reliably
**Risk:** this is the root cause of "I asked for one thing and something else
broke."

| File | Size |
|---|---|
| `src/app/pages/ProcessPayroll.tsx` | 53 KB |
| `src/app/pages/PayrollMaster.tsx` | 43 KB |
| ~~`src/app/pages/admin/AdminEmployeeSync.tsx`~~ | ~~36 KB~~ — deleted 2026-08-18 (`ba5a1f8`); replaced by `admin/employees/*`, largest 13.1 KB |
| `src/app/lib/classificationEngine.ts` | 35 KB |
| `src/app/pages/ActionRequired.tsx` | 34 KB |
| `src/app/pages/admin/AdminLookups.tsx` | 30 KB |

**One of the six is gone.** `AdminEmployeeSync.tsx` was replaced rather than
edited: the Employees hub was built alongside it as new files, verified against
it, and only then was it deleted. That is the pattern to repeat for the other
five.

Deliberately **not** split preemptively: refactoring a file this size *through*
UIB is itself the riskiest available operation. Split each one immediately
before substantial work begins in it, with the export diff already in place to
catch collateral damage.

---

## Feature roadmap — decided 2026-08-18

The "feature backlog blocked by fear of regression" (below) was decomposed
into seven sub-projects. Each gets its own spec → plan → build cycle. Almost
everything is additive — new tables, actions, pages — so it stays out of the
six oversized files (#9). Order:

| # | Sub-project | Status |
|---|---|---|
| A | Monday mirror layer — durable local tables for the Requests, Attendance-form, Contract and Directory boards, "Sync now" per board, config-driven IDs | ✅ built 2026-08-18 |
| B | PTO & leave tracker — balances (sheet's DAYS360/11 accrual), approvals ledger, floating holidays, request counts; Excel seeded once by migration | ✅ built and seeded 2026-08-19; balances reconcile to the spreadsheet |
| F | Employees admin consolidation — Employees + Directory Sync + Aliases into one tabbed page; folds in #3 phase 2; strangler pattern, old pages deleted last | ✅ built 2026-08-18 |
| D | Contract & milestone tracking (1 m/3 m/6 m/1 y/2 y, contract end, raise flag) | after A |
| C | Employee 360 — one-employee view composing directory, contracts, PTO, requests, attendance | after B, D |
| E | Calendar view of leave / permissions / WFH / birthdays | after A |
| G | Manager-scoped access — depends on UIB user roles (tech team); every new `load*` already takes an optional `manager` filter | last |

Spec for A + B + F:
`docs/superpowers/specs/2026-08-18-monday-mirror-and-pto-tracker-design.md`.

## Reported by the user, not yet diagnosed

- Wrong numbers — payroll totals, tardiness classification, discounts,
  attendance figures.
- Timezone and date bugs.
- UX that is not intuitive.
- ~~A feature backlog blocked by fear of regression.~~ → decomposed into the
  roadmap above.

Each needs a specific reproduction before it can be worked. "The June numbers
look off" is a usable starting point; the first step is finding the row that
proves it.

---

## Notes

Runtime logs were clean on 2026-08-11 — 0 errors, 0 warnings, all 10 actions
succeeding. The wrong-number problems are silent logic errors, not crashes, so
log-watching will not find them. Tests and export diffs will.
