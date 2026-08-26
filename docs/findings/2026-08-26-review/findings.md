# Code review findings — 2026-08-26

Produced by the code + sync + UI/UX review. Ranked by payroll risk. Every P0/P1
below is evidence-backed; where a number is claimed it was predicted first and
then measured in the live app, per `LESSONS.md`.

Phase 0 gate result: fresh export `GAF HR Hub (33).zip` synced with
`added: 0, changed: 1, removed: 0` — the single change was `version.yml`
(UIB platform 3.192.0 → 3.194.0). **Nothing under `src/` moved, and
`modelVersion` stayed 81, so nobody had edited the app since the last sync.**
The mirror is a faithful copy of what is live. Tests 96/96.

---

## P0 — Soft-deleted payroll rows are still counted on most screens

**The Summary Dashboard — the app's home page — overstates unpaid time by 126
hours for the current period.**

Measured live, 2026-08-26, period `Q2-Aug-2026`:

| Screen | Total discount hours | Action behind it |
|---|---|---|
| Dashboard → `DISCOUNT HOURS` | **308.2h** | `loadSummaryDashboard.ts` |
| HRK Summary → `Total Discount Hours` | **182.2h** | `loadHrkSummary.ts` |
| **Difference** | **126.0h** | = 18 rows × 420 min |

126.0 hours is exactly the 18 phantom off-day rows that migration
`1781900200` soft-deleted on 2026-08-25. `loadHrkSummary` filters
`deleted_at IS NULL` in all three of its CTEs; `loadSummaryDashboard` has no
such filter, so it still counts them. The figure was predicted before it was
measured and matched to the decimal.

This is not one screen. Eleven code paths that read `payroll_entries` omit the
filter:

| Action / view | What it feeds | Effect |
|---|---|---|
| `loadSummaryDashboard.ts:26-28` | Dashboard KPIs incl. discount hours | **P0 — payroll-adjacent number, wrong by 126h** |
| `loadSummaryAllPeriods.ts:24` | Per-period green/yellow/red totals | P1 |
| `v_attendance_daily` (all 16 definitions) | Whole Attendance dashboard | P1 — the deleted phantom rows still render as absences |
| `loadActionRequired.ts:12-14` | Action Required queue | P1 |
| `loadActionRequiredCounts.ts:10-13` | RED/YELLOW tab counts | P1 |
| `loadCommittedEntries.ts:12-14` | Committed entries table | P1 |
| `loadUnresolvedCount.ts:8-9` | Nav badge (currently reads 91) | P1 |
| `loadUnresolvedPerPeriod.ts:8-9` | Recent Periods "N open" | P1 |
| `loadPtoEmployeeDetail.ts:18-19, 43-44` | Payroll tally beside a PTO row | P2 |
| `updateEntryExit.ts`, `updatePayrollEntry.ts` | Edit by id | P3 — a deleted row remains editable |

### Proved inside the app, no database access needed

Two screens of the same app contradict each other on the same row:

| Screen | What it says about Cemiriamiz Iglesias, 2026-08-11 |
|---|---|
| **Period Log → Deleted Items** | Deleted `2026-08-25 20:07` by `migration-1781900200-weekend-offday-cleanup`; 420 disc-min; RED |
| **Action Required** (Q2-Aug-2026) | Live row awaiting resolution — `Ausencia Injustificada`, `NO DATA + NO FORM` |

The same is true of her 08-12, 08-18 and 08-19 rows — her Tuesday/Wednesday
off-days under schedule 11 (Mon,Thu,Fri,Sat,Sun). **Tim's work queue is showing
him deleted rows to resolve.** Period Log reports 20 deleted items; Action
Required has never heard of them.

**Why it was missed:** migration `1781900200`'s own comment says *"Upstream:
loadHrkSummary already filters deleted_at IS NULL"* — it named the one action
that was checked, and nobody swept the rest. The 2026-08-25 cleanup was verified
against Payroll Master and HRK Summary, both of which filter correctly, so the
verification passed while nine other screens stayed wrong.

**Fix:** add `AND deleted_at IS NULL` (or `pe.deleted_at IS NULL`) to each
action, and to `v_attendance_daily`. Independent, mechanical, and separately
verifiable — the Dashboard should fall to 182.2h and match HRK Summary exactly.

---

## P1 — Action Required can rewrite every selected row from one dropdown

`ActionRequired.tsx:169-192`. `setEditField` checks
`BROADCAST_FIELDS.includes(field) && selected.has(id) && selected.size > 1`, and
if so sets `targetIds = Array.from(selected)` — changing **one** dropdown writes
that value into **every selected row**, including auto-filling their
`pay_impact` and `documentation` from the rules map.

Correcting the design review, which called this a live database write: it stages
into `edits`, not the database, so a save step still follows. That lowers it from
P0 to P1. It does not make it safe — the operator then commits in bulk with no
preview of what changed.

The entire warning is a blue tint plus a **12-pixel dot** (`w-3 h-3`,
`text-[8px]`) at `ActionRequired.tsx:95-102`. That badge carries
`pointer-events-none`, so its `title="Will apply to all selected rows"` tooltip
**can never appear on hover**. The only explanation of the behaviour is
unreachable.

`PayrollMaster.tsx` — the near-identical grid — has the full safety net:
`showBulkConfirm` (`:107`), an `UndoSnapshot` type (`:53`), `handleUndo`
(`:304`) and an "Undo Bulk" button (`:495`). `ActionRequired.tsx` has none of
the three. Two pages, the same interaction, opposite safety.

**Fix:** port PayrollMaster's confirm-with-preview and undo. Give the broadcast
state a real label instead of an unhoverable dot.

## P1 — The Process re-run confirmation promises something the code does not do

`ProcessPayroll.tsx:309-312` warns, through a bare `window.confirm`:

> `"<period>" already has data. Re-running will replace ALL entries for this period. Continue?`

**It does not replace all entries.** `upsertPayrollEntries` is
`INSERT … ON CONFLICT DO UPDATE` and never deletes, so rows the engine no longer
generates — an off-day row after a schedule change — survive untouched with
their 420-minute discount intact. `HANDOFF-2026-08-25.md` §5 documents exactly
this: Tim re-processed after the weekend-schedule fix, believed it had cleaned
up, and the stale red rows were still there. **The wording contributed to a real
incident**, and it took a migration to remove the rows the operator had been
told were already replaced.

Compounding it, the highest-consequence action in the app gets an unstyled
browser popup with no employee count and no count of resolved RED/YELLOW work
about to be overwritten, while a routine single-row delete elsewhere gets a full
styled modal.

**Fix:** correct the sentence to say what actually happens (entries are
regenerated and updated; rows the engine no longer produces are left in place),
and replace `window.confirm` with the app's own modal, naming the period, the
employee count, and how much resolved work is at stake.

## P1 — Attendance date window rolls forward after 7pm Panama

`toISOString().slice(0,10)` returns tomorrow's date once local time passes
19:00, because Panama is UTC−5 year-round. Confirmed live defects:

- `GlobalFilterContext.tsx:5-6, 35-36` — `fmt(new Date())` seeds `TODAY` and the
  default 30-day window for the Attendance dashboard.
- `Attendance.tsx:39-42` — `today()` is the fallback whenever the operator
  **clears** the From/To date input, which is a normal UI action, not an edge case.
- `attendanceStats.ts:245` — narrower: only mis-flags the partial-week marker at
  the Sunday/Monday boundary. P3.

Verified **harmless**, do not change: `attendanceStats.ts:155`,
`AttendancePanel.tsx:43` (Postgres `DATE` → UTC-midnight round-trip),
`attendanceStats.ts:202` (local-midnight anchored), and `ptoAccrual.ts:56`
(pure `Date.UTC` arithmetic at both ends — TZ-invariant by construction).

## P1 — `teramindParser.ts:143` is reachable, and it can move money

Correcting what was said earlier in this session: this is **not** merely latent.
`parseWallClock` is called on every Teramind row (`teramindParser.ts:182-183`),
and its bare `new Date(s)` fallback fires whenever a timestamp misses the primary
regex. Its own comment concedes *"may be wrong in some TZ"*. When it fires it
yields a wrong `entry_time`/`exit_time`, which feeds `late_minutes` and
`discount_total_minutes`. Frequency depends on how often Teramind deviates from
its usual export format.

By contrast `classificationEngine.ts:187` **is** dead — `parseTeramindTimestamp`
has no caller anywhere in `src/`. It deserves the same explicit "never wire this
back up" note that `teramindToPanama` already carries in `AGENTS.md`.

## P1 — The H4 test does not scan the file it most needs to

`ProcessPayroll.tsx:211-213, 220-230` holds 14 hardcoded Monday board/column ids
as silent `cfgGet(key, '<literal>')` fallbacks. They would match H4's own
regexes — but `tests/hardcoding.test.ts:132-150` never scans that file. So
`CLAUDE.md:65` ("Tests H4/H5 fail the build if one appears in code") and
`BACKLOG.md:123-124` ("removed the last hardcoded IDs") are both untrue for the
one file that actually drives payroll classification.

## P1 — The database cannot be rebuilt from this repo

Replaying `src/migrations/*.sql` in timestamp order **hard-fails**:
`1781803700_revive_pto_tables.sql` runs `ALTER TABLE pto_approvals …`, but the
only `CREATE TABLE` for `pto_approvals`, `pto_employees` and
`pto_floating_holidays` lives in `docs/recovered-migrations/1781402200_create_pto_tables.sql`,
outside `src/`. Eight live PTO actions depend on those tables.

`applied.txt` lists 25 of 46 files. **It is written by UI Bakery, not by hand** —
`git log --follow` shows it changing only inside `sync:` commits — so the 21-file
hole cannot be repaired locally; an edit would be destroyed by the next export.
The authoritative ledger is the `uib_migrations` table inside UIB, which holds
the full SQL of every applied migration.

## P2 — `v_attendance_daily` has silently regressed twice

The view has been redefined 16 times. Two fixes were dropped and never restored:

- **Date serialization.** `1781290300` changed the output to
  `TO_CHAR(work_date,'YYYY-MM-DD') AS date` precisely because a raw date
  serializes as an ISO timestamp through the JS driver. `1781400200` did a
  `DROP`/`CREATE` and reverted to `work_date AS date`; every later definition
  including the current `1781900100` kept the revert.
- **Time format token.** `1781400600` fixed `'HH12:MI AM'` (not valid Postgres)
  to `'HH:MI AM'`. `1781401300` reintroduced `'HH12:MI AM'`, and `1781900100`
  still carries it.

Both need confirming against live data before any change.

## P2 — `loadActionRequiredCounts.ts:13` breaks the NULL-safe pattern

It uses `{{params.periodName}} = ''` where four siblings use
`COALESCE({{params.periodName}}, '') = ''`. **Currently inert** — the only
caller passes `period` from `useState('')`, always a string. But it is the exact
shape of the bug that has now bitten three times, one refactor away from
returning.

## P2 — The three Attendance donuts are blank until you touch a filter

Found by inspecting the running app; neither the source review nor the detector
caught it, because it only exists at runtime.

On first load of `/attendance`, all three donut charts render an **empty SVG** —
verified in the DOM, not just by eye: each `svg.recharts-surface` measures
505×170 and contains **zero `<path>` elements**. The centre percentage and the
legend still draw, so the card looks intentional rather than broken. Click any
filter (e.g. the 60d preset) and all three draw correctly and look good.

`AttendanceDonuts.tsx:18-27` wraps `ResponsiveContainer` in a `div` with an
inline `height: 170`. This is the classic Recharts case of the container
measuring zero width at mount and never re-measuring. The data is fine — the
legend proves it.

**Fix:** give the chart a deterministic size or force a re-measure on data
arrival. Worth confirming in the browser after the change, since it cannot be
seen in a diff.

---

# Design review

Nielsen total **27/40** (Assessment A, source-based). The mechanical detector
(Assessment B) returned exit 2 with **6 findings — 5 of which are false
positives**: the rule pairs the first `bg-*` and first `text-*` on a line, and
every hit is a ternary where those two classes are on opposite branches and
never co-occur. The one real finding is `TopNav.tsx:182`, an easing curve of
`cubic-bezier(.22,.68,0,1.2)` whose 1.2 endpoint overshoots — inconsistent with
the project's own `tailwind.config.js` easing, which never exceeds 1.

## The design system is declared but not connected

- **21 of 32 design tokens are dead (66%)** — never referenced by a utility
  class or by `tailwind.config.js`. That includes all six `--chart-*` tokens,
  both `--topnav*`, and `--secondary` (while `#2aa876` is hand-typed 9 times).
- **All eight `--shadow-*` tokens have zero consumers.** The config never wires
  them into `boxShadow`, so the 45 `shadow-*` classes in the app render
  Tailwind's stock defaults. **Every shadow you currently see is an accident**,
  not the brand value.
- `tailwind.config.js` sets `fontFamily.sans` to `var(--layout-text-font-family)`,
  **a variable declared nowhere in the project**, so the Inter in `index.css`
  never wins. It also references eight `--sidebar-*` vars that do not exist.
- **132 hardcoded hex literals, 33 distinct values.** 29 of them (22%) re-type a
  color that already has a token.
- **12 distinct font sizes** in play — six scale steps plus six arbitrary pixel
  values (10/11/12/13/14px) that sit *between* `text-xs` and `text-sm`. 91
  arbitrary-px uses against 400 scale uses.
- Clean, and worth keeping: **zero** arbitrary radius values, **zero** arbitrary
  spacing values, zero inline `boxShadow`.

## Accessibility is largely absent

- **One `aria-label` in the entire app**, and it is on a decorative icon
  (`InfoTip.tsx:4`). Zero buttons and zero form controls have one.
- **73 form controls** (44 inputs, 29 selects); only **4** are explicitly
  associated with a label via `htmlFor`, all in `RecordApprovalDialog.tsx`.
- Six icon-only buttons have neither `title` nor `aria-label`.
- `ActionRequired.tsx:464` — the employee name toggles row selection via
  `onClick` on a `<span>` with no `role`, `tabIndex` or key handler. **Keyboard
  users cannot select rows** on the page built for resolving payroll.
- Focus rings appear on **13 of 136 interactive elements (9.6%)**, against a
  brief that requires `ring-2 ring-primary/30` on every one.
- Status on the payroll grids is carried by background tint alone, with no text
  or icon redundancy — invisible to a colour-blind operator.

## On the Excel colours — keep them, but define them once

The design review's judgment, which I agree with: Tim reads those green/yellow/red
fills the way he reads them in Excel, and retiring them would cost recognition
speed rather than gain polish. **The problem is not the colours, it is that
`#C6EFCE`/`#FFEB9C`/`#FFC7CE` are re-typed as raw hex across four files** and
have already drifted into eight variants. Promote them to named status tokens in
`index.css` beside the brand colours, then consume them everywhere.

## The five shared components never spread

`PageHeader`, `DataTable`, `StatusChip`, `EmptyState` and `InfoTip` were built in
the 2026-08-19 premium pass and are used by the PTO page alone. Live comparison
confirms the gap: PTO has a real page header, per-column info tooltips, tabular
figures and consistent chips; Payroll Master reads as a raw spreadsheet with
truncated headers (`Disc m`, `Late m`) and an Exit column so narrow that
`5:00 PM` is clipped to `5:00 PI`. Four unrelated badge systems and three
duplicate sort-icon components exist for the same two jobs.

## P3 — Smaller items

- `FilterBar.tsx:22` shows a From/To date filter on `/process`, but
  `ProcessPayroll.tsx` never reads `dateFrom`/`dateTo`. A control that does nothing.
- `deleteLookup.ts:10-21`, `upsertLookup.ts:9-23` — `NULL NOT IN (...)` is `NULL`,
  so the guard is bypassed and the block silently no-ops. Mitigated at the caller.
- `updateEmployeeStartDate.ts:9` matches on `display_name`, a non-unique column.
- Stale docs: `CLAUDE.md:48` says baseline 87 (actual 96); `CHANGE-LOOP.md:111`
  still lists `AdminEmployeeSync.tsx`, deleted 2026-08-18 and asserted absent by H5.

## Verified clean

No `{ params: {...} }` wrappers anywhere. No `{{params.}}` inside quoted strings.
No hardcoded Monday **group** ids. The Current-Employees rule is correctly
enforced at the sync boundary (`syncDirectory.ts:150`) with no unfiltered
consumer. Working tree clean in both checkouts.
