# AGENTS.md — GAF HR Hub

Standing instructions. Read this before every change. Everything below was
derived from the code and migrations in this project, not from assumption.

---

## Non-negotiables

1. **Never convert a clock time between timezones.** Every stored time is a US
   Eastern wall-clock string. See [Timezone rules](#timezone-rules).
2. **Never change the database without a migration.** No ad-hoc DDL, no
   `ALTER` inside an action.
3. **Never hand-edit `src/migrations/applied.txt`.** It is an export artifact
   and it is already wrong.
4. **Never hardcode a Monday.com board or column ID.** Read it from
   `classification_config`. See [Monday.com integration](#mondaycom-integration).
5. **Never build on `pto_employees`, `pto_approvals`, or
   `pto_floating_holidays`.** They are dead scaffolding.
6. **One coherent change per prompt.** Touch only the files named in the
   request. Six files in this project are large enough that unrelated code
   breaks when they are edited — see [Hard constraints](#hard-constraints).

---

## What this app is

Payroll and attendance processing for GAF Healthcare's Panama-based staff, who
work **US Eastern** hours. Internally called *Planilla*.

- **Platform:** UI Bakery vibe project `GAF HR Hub` (`internalType: vibe_project`).
  React 19, `react-router-dom` 6, Tailwind 3, shadcn-style primitives under
  `src/components/ui/`, `recharts` for charts, `xlsx` (SheetJS) for file parsing.
- **Datasources** (`datasources.yml`):
  - `GAF Planilla DB` — PostgreSQL, primary, holds everything.
  - `Monday.com API` — GraphQL. The only datasource the three HTTP actions
    (`pullMondayBoard`, `loadEmployeeDirectory`, `fetchMondayStartDates`)
    actually name.
  - `Monday.com API v2` — connected but referenced by no action in `src/`.
    Do not switch an action to it without being asked.
- **The run:** an operator uploads a Teramind activity export (CSV or XLSX) on
  the Process page, the engine pulls three Monday.com boards, classifies every
  employee-day in the period, and writes rows to `payroll_entries`. The
  operator then resolves the YELLOW/RED rows, and exports an HRK summary.

The classification engine is **TypeScript running in the browser**
(`src/app/lib/classificationEngine.ts`), not SQL. The database stores results,
it does not compute them. The one exception is `v_attendance_daily`, which is a
SQL view and is the sole data source for the Attendance dashboard.

---

## Schema

19 relations in `GAF Planilla DB`. Column types below are from
`src/migrations/1781189300_gaf_planilla_initial.sql` and the `ALTER` migrations
that followed it.

### Core payroll

**`payroll_entries`** — the fact table. One row per employee per work date per
period. Unique on `(period_name, employee_id, work_date)`; the engine upserts
on that key, so re-running a period overwrites in place.

- `work_date` is **TEXT**, formatted `"2026-04-11 (Sat)"` — not a `DATE`.
  Every SQL consumer must do `LEFT(work_date, 10)::date`. Do not "fix" this to
  a date column; the whole app and the view depend on the text form.
- Time columns — `entry_time`, `exit_time`, `scheduled_start`, `scheduled_end`,
  `grace_until` — are **TEXT**, US Eastern wall clock, format `H:MM AM` /
  `H:MM PM` (no leading zero on the hour).
- Minute columns — `late_minutes`, `late_after_grace`, `early_leave_minutes`,
  `discount_total_minutes` — are relative, so they are timezone-invariant.
- Classification columns — `event_type_1`, `pay_impact_1`, `event_type_2`,
  `pay_impact_2`, `documentation`, `notes`, `auto_notes`.
- Status columns — `initial_status`, `status_current` (`GREEN`/`YELLOW`/`RED`),
  `payroll_ready` (`YES`/`NO`), `resolved_by`, `resolved_at`.
- Soft delete — `deleted_at`, `deleted_by` (added `1781402100`). Deletes are
  soft; `PeriodLog` restores from them. Never issue a hard `DELETE` on this
  table outside a migration.

**`periods`** — one row per payroll period. `period_name` (unique, and the join
key used everywhere instead of an id), `start_date`, `end_date`,
`processed_at` (TEXT), `employee_count`, `day_count`, `green_count`,
`yellow_count`, `red_count`, `notes`.

**`run_snapshots`** — archive of raw run inputs. `period_name`,
`snapshot_type`, `raw_data` (TEXT), `created_at`. Written by `saveRunSnapshot`,
deleted per-period by `deletePeriodSnapshots`.

**`hrk_exports`** — one row per HRK summary export. `period_name`,
`exported_at`, `exported_by`, `summary_json` (TEXT). Created by
`1781401000`.

### People and shifts

**`employees`** — `display_name`, `teramind_email` (unique; **this is the join
key to Teramind data**), `company_domain`, `schedule_id` → `schedules`,
`is_grace_list`, `is_macbook_swap`, `excluded_from_payroll`, `active`,
`start_date`, `end_date`, `notes`, plus `role` and `manager` (added by
`1781400300`, populated by Admin → Directory Sync from Monday.com).

**`schedules`** — shift definitions. `schedule_name` (unique), `grace_minutes`
(default 10), `work_days` (CSV of day abbreviations, default
`'Mon,Tue,Wed,Thu,Fri'`, added by `1781402000`), `notes`, and four time columns:

- `dst_start` / `dst_end` — the **summer (US Eastern)** pair.
- `standard_start` / `standard_end` — the **winter (US Eastern)** pair.

The `dst_*` / `standard_*` names are historical. They no longer mean "convert
for DST"; they hold two Eastern wall-clock pairs and the engine picks one. For
Eastern-synced staff the pairs are identical (9–5 / 9–5). For staff whose
region ignores US DST (the Arizona schedule) they differ: 10–6 summer, 9–5
winter.

**`name_aliases`** — `alias_text` (unique) → `employee_id`. Resolves name
variants appearing in Teramind exports and on Monday.com boards to the right
employee. Without a matching alias, a board row silently fails to attach and
the day is classified as an unjustified absence.

**`dst_calendar`** — `year` (unique), `us_dst_start`, `us_dst_end` (both DATE).
**Used only to choose which schedule pair applies.** It is not a conversion
table and must never be used to shift a time value.

**`holidays`** — `date` (unique), `name`. Panama public holidays.

### Lookups and rules

**`event_types`**, **`pay_impacts`**, **`documentation_options`** — flat
name-only lookups (`id`, `name` unique) that populate the operator dropdowns on
Action Required and Payroll Master. **The engine does not read them.** It emits
hardcoded strings (`'Tardanza'`, `'Salida Temprano'`, `'Feriado'`, `'PTO'`,
`'Ausencia Justificada.'`, `'Ausencia Injustificada'`, `'Permiso Remunerado'`,
`'Permiso No remunerado'`, `'Paid (Grace)'`, `'Unpaid (with Grace)'`,
`'Unpaid (without Grace)'`, `'Paid – Sin Compensatorio'`, `'Incapacidad'`,
`'Paid – Exception'`). Renaming a row in these tables does **not** rename what
the engine writes, and will desynchronise the dropdowns from the stored data.
Note `'Ausencia Justificada.'` carries a trailing period — it is load-bearing.

**`event_type_rules`** — `event_type` (unique) → `default_pay_impact`,
`default_doc_option`, `notes`. Read by `ActionRequired.tsx` and
`PayrollMaster.tsx` to prefill the pay impact and documentation dropdowns when
an operator picks an event type. Not read by the engine.

**`classification_config`** — `key` (unique), `value`, `label`, `description`,
`value_type`, `category`. Edited at Admin → Rules & Config
(`AdminLookups.tsx`). Categories in use: `tardiness`, `grace`, `absence`,
`early_leave`, `monday_boards`, `monday_columns`, `internal`.

The engine reads exactly **four** keys, via `buildClassificationConfig`:
`non_grace_auto_resolve`, `non_grace_auto_impact`, `early_leave_auto_impact`,
`full_day_absence_discount_minutes`. Four other seeded keys —
`tft_late_red_threshold_minutes`, `grace_pardon_requires_form`,
`grace_excess_split_event`, `no_data_no_form_impact` — are displayed in the
admin UI but are **read by no code**. Changing them has no effect. Do not
assume any config key is wired up; grep for it first.

### Views and infrastructure

**`v_attendance_daily`** — the only source for the Attendance dashboard.
Projects `payroll_entries` joined to `employees` (active, not
`excluded_from_payroll`) into `email`, `name`, `date`, `entry_time`, `status`,
`bucket`, `filed_gaf`, `minutes_late`, `period_name`. Weekdays only
(`ISODOW < 6`), `DISTINCT ON (employee_id, work_date)`.

Its current definition is `1781401300_fix_view_remove_dst_display_offset`. It
reports `minutes_late` straight from `payroll_entries.late_minutes` — it does
**not** recompute lateness, and must not be changed to. Nine earlier
definitions live in `docs/recovered-migrations/`; they existed only inside the
database until they were recovered. Read them before touching the view.

**`uib_migrations`** — UI Bakery's own migration ledger, with `sql_content` for
every migration that ever ran. **It is authoritative.** No application code
reads it. On this project it holds 46 rows while `src/migrations/` holds 35
`.sql` files and `applied.txt` lists 14. Trust the ledger, never `applied.txt`.

### Dead — do not build on these

**`pto_employees`**, **`pto_approvals`**, **`pto_floating_holidays`** — created
by `1781402200_create_pto_tables` (2026-07-22), abandoned scaffolding from a
PTO feature that was set aside. **No page, action, or query reads or writes
them.** The owner will rebuild PTO from scratch on a new schema. Do not read
them, do not write them, do not extend them, and do not "reconnect" them to
anything. They will be dropped as part of that rebuild.

Beware the false positive: `pto_days`, `pto_dates`, `pto_count` in
`loadHrkSummary.ts` and `HrkSummary.tsx` are CTE aliases derived from the `PTO`
*event type* on `payroll_entries`. That is a separate, live feature and has
nothing to do with these three tables.

---

## Timezone rules

**This is the section that matters most.** Roughly twenty migrations in this
project are successive fixes to the same timezone bug. One of them corrupted
real payroll data and had to be reverted. Read the invariant, then the history
that produced it.

### The invariant

> **Every clock time in this system is a US Eastern wall-clock string. Store it
> as written, read it as written, display it as written. Never apply a
> timezone conversion, an offset, or a DST adjustment to any time value,
> anywhere — not on write, not on read, not on display.**

Concretely:

- `payroll_entries.entry_time`, `.exit_time`, `.scheduled_start`,
  `.scheduled_end`, `.grace_until` are TEXT in `H:MM AM` / `H:MM PM`, US
  Eastern.
- `schedules.dst_*` and `schedules.standard_*` are TEXT in the same format, US
  Eastern. `dst_*` is the summer pair, `standard_*` the winter pair.
- Teramind exports are **already US Eastern**. `parseTeramindFile` reads with
  `cellDates: false` and `parseWallClock` builds a `Date` from explicit
  year/month/day/hour/minute components, so the runtime timezone can never
  shift the value. `formatTime12` writes it back. **`teramindParser.ts`
  performs no timezone conversion at any point, by design.**
- `dst_calendar` + `isDst()` select which schedule pair applies. That is their
  only job. They never move a time.
- `late_minutes`, `late_after_grace`, `early_leave_minutes` and
  `discount_total_minutes` are differences between two times in the same clock,
  so they are timezone-invariant. 8:06 vs 8:00 equals 9:06 vs 9:00 equals six
  minutes. Never recompute them against a reference in a different zone.
- Dates are keyed with `toLocalYMD()`, which reads local calendar fields.
  **Never use `toISOString()` to derive a work date** — in any negative-offset
  zone it rolls to the next day after 19:00 local.

### Things that must never be reintroduced

- `+ interval '1 hour'` (or `- interval '1 hour'`) anywhere in
  `v_attendance_daily`. It was there; `1781401300` removed it.
- `teramindToPanama()` in `classificationEngine.ts`. It still exists and is
  **called by nothing**. It is a leftover from the Panama-native era. Do not
  call it, do not "wire it back up". Treat it as deleted.
- `cellDates: true` in the SheetJS read. It produces UTC `Date` objects and was
  the direct cause of a one-hour shift.
- Re-running `1781400100_history_panama_to_eastern`, or clearing the
  `history_tz_converted` key from `classification_config`. That key is the
  guard proving the one-time historical conversion has already run. Removing it
  would let a `+1 hour` shift be applied to real payroll rows a second time.

### Why the rule exists — the actual history

The underlying fact: Panama is UTC−5 year round; US Eastern is UTC−4 in summer
and UTC−5 in winter. So for roughly eight months of the year Eastern is Panama
+ 1 hour, and for four months they are identical. Every bug below is that one
hour appearing or disappearing.

**Era 1 — Panama-native (June 2026).** `1781280000` created
`v_attendance_daily` comparing `entry_time` against
`schedules.standard_start`. Nine successive fixes followed, all recovered in
`docs/recovered-migrations/`: time-parser fixes (`1781280100`), reported-lateness
status (`1781280200`), classification of excused days (`1781280300`), using the
stored `late_minutes` instead of recomputing (`1781280400`), four separate
attempts to make the date column come out as plain text
(`1781290000`–`1781290300`), and finally `1781290400_fix_view_dst_aware`, which
made the view subtract one hour from Teramind's Eastern times during US DST to
display Panama time.

**Era 2 — the switch to Eastern-native (`1781400000`, `1781400100`).**
`1781400000_us_eastern_schedules` reinterpreted the schedule columns as US
Eastern with no conversion, and set the three real schedules explicitly:
Standard 9–5 ET year round, Monique Luque 9–4 ET year round, Favian Fortune
(Arizona, no US DST) 10–6 ET summer and 9–5 ET winter.

`1781400100_history_panama_to_eastern` then converted the historical data: a
one-time `+1 hour` shift of the **display-time columns only** on DST-dated rows
in exactly five periods — `Q2-Mar-2026`, `Q1-Apr-2026`, `Q2-Apr-2026`,
`Q1-May-2026`, `Q2-May-2026` — about 2,140 rows. Minute columns, statuses,
event types and pay impacts were deliberately left untouched, so pay was
unaffected. It is guarded by `classification_config.history_tz_converted =
'true'` so it cannot run twice, and it carries a manual revert block in its
footer.

`1781400200_attendance_use_stored_late_minutes` fixed the resulting dashboard
bug: the view was recomputing lateness from a Panama-time `entry_time` against
an Eastern-time shift start, so everyone appeared to arrive early and the
on-time rate showed a false ~97%.

**Era 3 — string-format fallout (`1781400500`, `1781400600`, `1781400700`,
`1781401900`).** Because times are stored as strings, the view's parser broke
on every format variant in the real data, each requiring a full view rewrite:
lowercase `am`/`pm` (`1781400500`), the invalid Postgres format token `HH12`
which had to become `HH` (`1781400600`), and values with no minutes such as
`"9am"` (`1781400700`). `1781401900` later rewrote `' AM'` to `' PM'` on
single-digit-hour times in *Planilla 2 Junio 2026*, repairing rows an AM/PM
parsing bug had stored as AM.

**Era 4 — the shift that corrupted payroll and was reverted
(`1781401100`–`1781401400`).** This is the cautionary tale.

`1781401100_fix_tz_shift_post_migration_periods` added `+1 hour` to
`entry_time` and `exit_time` for two periods — *Test Period May 25th - Jun 10th*
and *Planilla 2 Junio 2026 11-19* — on the theory that a SheetJS
`cellDates: true` bug had read Teramind times an hour behind Eastern. Crucially,
it did not stop at display columns: it **recomputed `late_minutes`,
`late_after_grace`, `early_leave_minutes`, `discount_total_minutes`,
`initial_status`, `status_current` and `auto_notes`** from the shifted values.
`1781401200` then rebuilt the `auto_notes` text to match the new minute counts.

The premise was wrong. The parser was already producing US Eastern times, so
the shift made every employee in those two periods appear an hour late and
inflated their `discount_total_minutes` by that hour. Worse, its status rule
wrote those newly-late rows to **GREEN** with an auto-resolved
`Unpaid (without Grace)` note — so the extra docked minutes were marked ready
for payroll and never went in front of an operator. Real pay was wrong and
nothing surfaced it.

`1781401400_revert_tz_shift_corrupted_periods` — the file name says
*corrupted* — subtracted the hour back out and recomputed every derived field
again. Both migrations restricted themselves to `resolved_by IS NULL` intending
to spare operator decisions, and skipped rows annotated `Macbook swap`,
`Teramind outage` or `Weekend activity`. The `resolved_by` guard was inert (see
[Status and `payroll_ready`](#status-and-payroll_ready--computederivedfields)) —
the only thing that actually limited the blast radius was the two named periods.

`1781401300_fix_view_remove_dst_display_offset` removed the matching cosmetic
`+1 hour` from the view, which had been making 9:11 AM display as 10:11 AM.

**What to take from this.** A timezone change here is never a display-only
change. `late_minutes` drives `discount_total_minutes`, which drives what a
person is paid, and `initial_status` drives whether a human ever looks at the
row. A one-hour edit made in good faith, with a plausible written rationale,
silently altered real pay. **If a change touches any time or date value,
restate this invariant, name every column affected, and say explicitly whether
minute columns and statuses are recomputed. If you cannot state that, do not
make the change.**

---

## Classification model

**Rule: the engine is the only thing that classifies. Pages resolve; they do
not reclassify.** All engine logic lives in
`src/app/lib/classificationEngine.ts` and is invoked once, from
`ProcessPayroll.tsx`, via `runClassificationEngine(input)`.

### How the four tables combine

- `classification_config` supplies four runtime switches through
  `buildClassificationConfig(rows)`; everything else is hardcoded.
- The engine writes `event_type_1/2` and `pay_impact_1/2` as **literal
  strings**. `event_types` and `pay_impacts` exist so operator dropdowns can
  offer the same strings.
- `event_type_rules` maps a chosen `event_type` to a `default_pay_impact` and
  `default_doc_option`, applied by the **UI** when an operator picks an event
  type on Action Required or Payroll Master.
- `pay_impacts` values are what `computeDiscount` switches on, by exact string
  match. Adding a pay impact to the lookup table does not teach
  `computeDiscount` what it means.

### Decision order in `runClassificationEngine`

Evaluated per employee per date, first match wins:

0. **Outage date** (operator-supplied list) → schedule times filled in, GREEN.
1. **Not a scheduled work day** (per `schedules.work_days`) → skipped silently
   unless a Monday form covers it, in which case YELLOW for review.
2. **Holiday** (`holidays`) → `Feriado`. GREEN with
   `Paid – Sin Compensatorio`, or YELLOW if Teramind shows they worked.
3. **Full-day permission** (Monday Permissions board) → `PTO` /
   `Permiso Remunerado` / `Permiso No remunerado`, GREEN — except Time-for-Time,
   which is YELLOW.
4. **Absence form** (Monday Attendance board) → `Ausencia Justificada.`,
   YELLOW; **RED** if Teramind also shows activity that day (a conflict).
5. **Macbook swap** with no Teramind data → schedule times, GREEN.
6. **No data and no form** → `Ausencia Injustificada`, RED, and
   `discount_total_minutes` is set directly to
   `cfg.full_day_absence_discount_minutes` (default 420).
7. **Normal day with data** → tardiness and early-leave logic below.

### Tardiness, grace, and TFT

`late_minutes = max(0, entry − scheduled_start)`;
`early_leave_minutes = max(0, scheduled_end − exit)`;
`late_after_grace = max(0, late_minutes − grace_minutes)`.

Grace lives in two places and they are different things:

- **`schedules.grace_minutes`** is a per-schedule number. `getSchedule()` uses
  it to compute the `grace_until` display string, and `late_after_grace` is
  computed from it for *every* row.
- **`employees.is_grace_list`** is what decides whether the grace *policy*
  applies to that person.

For a late employee, in order:

1. **TFT on file** (Time-for-Time, detected from the Adjustments board type
   containing `time for time` / `tft` / `time adjustment` / `late time payback`,
   or a Permissions row containing `time for time` / `tft`) → **always YELLOW**,
   blank pay impact, regardless of how late. This overrides everything below.
2. **On the grace list, form filed, late ≤ `grace_minutes`** → `Paid (Grace)`,
   GREEN, no discount.
3. **On the grace list, form filed, late > `grace_minutes`** →
   `Unpaid (with Grace)`, GREEN, discount = `late_after_grace`.
4. **On the grace list, no form** → `cfg.non_grace_auto_impact`, GREEN,
   discount = `late_minutes`.
5. **Not on the grace list**, with `non_grace_auto_resolve` true (the default)
   → `cfg.non_grace_auto_impact` (default `Unpaid (without Grace)`), GREEN.
   With it false → blank impact, YELLOW.

Early leave takes `event_type_2` if `event_type_1` is already used. If both
slots are full the engine cannot record a third event; it appends a warning to
`auto_notes` and escalates to YELLOW.

### Discount minutes — `computeDiscount`

Keyed off the **event type in each slot**, never the slot number, because
`Tardanza` and `Salida Temprano` can land in either slot.

- A full-day unpaid event (`Permiso No remunerado`, `Ausencia Injustificada`,
  `Ausencia Justificada.`, `Unpaid Leave`, `Leave Without Pay`, `LWOP`) with
  pay impact exactly `Unpaid` → `fullDayMinutes`.
- `Tardanza` with `Unpaid (with Grace)` → `late_after_grace`;
  with `Unpaid (without Grace)` or `Unpaid` → `late_minutes`.
- `Salida Temprano` with any of `''`, `Unpaid`, `Unpaid (with Grace)`,
  `Unpaid (without Grace)` → `early_leave_minutes`.

**Known inconsistency — do not "fix" it without asking.** `computeDiscount`'s
`fullDayMinutes` parameter defaults to **480**, and no caller ever passes a
value: not `runClassificationEngine`, not `ActionRequired.tsx`, not
`PayrollMaster.tsx`. But the no-data absence path in step 6 overwrites the
result with `cfg.full_day_absence_discount_minutes`, default **420**. So a
full-day absence discounts 420 minutes when the engine creates it and 480 when
an operator re-saves the row. Changing either number changes what people are
paid.

### Status and `payroll_ready` — `computeDerivedFields`

- `initial_status` is what the engine decided. It is never recomputed by a page.
- `payroll_ready = 'YES'` when `initial_status` is GREEN (always), or when
  `event_type_1` is non-empty and every filled event slot has a pay impact.
- `status_current = payroll_ready === 'YES' ? 'GREEN' : initial_status`.
- A row where the *engine* auto-filled `pay_impact_1` is still GREEN and ready.
  A YELLOW/RED row only clears once an operator saves it from Action Required or
  Payroll Master.

**`resolved_by` is a trap.** Four data-repair migrations (`1781401100`,
`1781401400`, `1781401600`, `1781401700`) skip rows where
`resolved_by IS NOT NULL`, on the assumption that this marks an operator
decision. But **nothing in this codebase ever writes `resolved_by` or
`resolved_at`** — not `updatePayrollEntry`, not `updateEntryExit`, not any
migration. The column is effectively always NULL, so that guard protects
nothing. Do not write a migration that relies on it to spare operator work, and
do not start populating it as a side effect of an unrelated change; wiring it up
is its own deliberate task.

### The mid-day pull backfill

When Teramind is exported before the working day ends, exits look artificially
early. If `midDayPull` is on **and** the row's date equals `midDayPullDate`
**and** the recorded exit is more than 30 minutes before the scheduled end, the
exit is replaced with the scheduled end.

`midDayPullDate` is the gate, and it is load-bearing. `ProcessPayroll.tsx`
passes `new Date().toLocaleDateString('en-CA')` (today). Before this gate
existed, the backfill rewrote genuine early departures on *earlier* days of the
period to the scheduled end, under-docking real early leaves. Two tests in
`tests/hardcoding.test.ts` (H2, H2b) pin this behaviour. Never widen the gate.

---

## Monday.com integration

**Rule: read every board ID and column ID from `classification_config`. Never
hardcode one, and never invent one.**

The keys live under categories `monday_boards` and `monday_columns` and are
editable at Admin → Rules & Config. `ProcessPayroll.tsx` reads them through a
local `cfgGet(key, fallback)` helper over the rows returned by
`loadClassificationConfig`:

| Board | Config key | Seeded value |
|---|---|---|
| GAF Attendance Form | `monday_board_attendance` | `9542698245` |
| Time Adjustments / TFT | `monday_board_adjustments` | `18394647909` |
| Permissions & Requests | `monday_board_permissions` | `18394590373` |
| Panama Employee directory | `monday_board_directory` | `8592460836` |

Column keys follow the same pattern: `monday_col_attendance_email|date|type|reason`,
`monday_col_adjustments_email|date|type`,
`monday_col_permissions_email|daterange|type|type_alt`,
`monday_col_directory_role|manager`.

`pullMondayBoard.ts` is a generic HTTP action against the `Monday.com API`
datasource — it takes `params.query` and `params.variables` and holds no IDs
itself. All board and column IDs are supplied by the caller. That is the
correct pattern.

### Why the config is authoritative — the manager-column incident

The employee directory sync was written against the wrong Monday column ID for
manager, `text_mkzj8b73` instead of `text_mkzj84w1`. Both are valid column IDs
on that board, so nothing errored: the API returned a real column holding
different data, the sync wrote it into `employees.manager`, and employees were
matched and reported against the wrong manager. It was caught by a human
noticing wrong names in the UI, several turns after the change had shipped —
not by a test, a type error, or a log line.

**A wrong Monday ID fails silently and produces plausible-looking wrong data.**
That is exactly why these IDs belong in `classification_config`, where the
operator can see and correct them, rather than in code where they can only be
guessed at. Never write a column ID from memory or by pattern-matching another
ID; take it from config, or ask.

### Two current violations — fix on sight, do not copy

- `src/actions/loadEmployeeDirectory.ts` hardcodes board `8592460836` in a raw
  GraphQL string, duplicating `monday_board_directory`.
- `src/app/pages/admin/AdminEmployeeSync.tsx` hardcodes column IDs
  `text_mkzj84w1` (manager), `text_mkzjgsxv` (employee email), `text_mm63b2xk`
  (role) and `color_mkyjv6et` (active status), instead of reading
  `monday_col_directory_role` / `monday_col_directory_manager`.

These are the code paths the incident above happened in. Do not add new
hardcoded IDs anywhere, and when editing either file, move the IDs into config
rather than duplicating the pattern.

### Matching board rows to employees

`rowMatchesEmp()` resolves in this order: **email first**, then `nameMap`
(normalized `display_name` plus every `name_aliases.alias_text`), then a direct
normalized name comparison. `normalizeName` strips accents, lowercases, and
collapses whitespace. A board row that resolves to nobody is dropped — the day
then falls through to "no data and no form" and becomes a RED unjustified
absence. When a real absence shows up as an unexplained RED, a missing
`name_aliases` row is the first thing to check.

---

## File map

### Routes — `src/app/app.tsx`

| Route | Component | Owns |
|---|---|---|
| `/` | → `/summary` | redirect |
| `/summary` | `SummaryDashboard.tsx` | per-period KPIs and charts, read-only |
| `/process` | `ProcessPayroll.tsx` | the whole run: Teramind upload, Monday pulls, unmapped-name resolution, engine invocation, batched writes, period counters |
| `/action-required` | `ActionRequired.tsx` | the YELLOW/RED queue; operator assigns event types and pay impacts, bulk commit |
| `/payroll-master` | `PayrollMaster.tsx` | full editable grid of all entries, soft delete, export |
| `/hrk-summary` | `HrkSummary.tsx` | the HRK payroll summary and its export into `hrk_exports` |
| `/period-log` | `PeriodLog.tsx` | period list, rename, delete, restore soft-deleted entries, past exports |
| `/attendance/*` | `Attendance.tsx` | attendance dashboard; three tabs driven by URL, one component instance so tab switching does not remount |
| `/admin/*` | `admin/AdminLayout.tsx` | admin shell with nested routes |

Admin children: `employees` (`AdminEmployees.tsx`), `directory-sync`
(`AdminEmployeeSync.tsx`), `aliases` (`AdminAliases.tsx`), `schedules`
(`AdminSchedules.tsx`), `holidays` (`AdminHolidays.tsx`), `dst-calendar`
(`AdminDstCalendar.tsx`), `lookups` (`AdminLookups.tsx`, labelled
"Rules & Config" — owns `event_types`, `pay_impacts`, `documentation_options`,
`event_type_rules` and `classification_config`).

### Navigation and shared state

- `src/app/TopNav.tsx` — three sections (Payroll, Attendance, Admin), each with
  its own sub-links and colour. The Action Required badge count comes from
  `loadUnresolvedCount`. Adding a page means adding it here **and** in
  `app.tsx`.
- `src/app/FilterBar.tsx` — the global filter strip. `ROUTE_CONFIG` declares
  which filters each route shows (period, date range, employee, role, manager).
- `src/app/context/GlobalFilterContext.tsx` — holds the filter state plus
  `periodsVersion`, a counter pages bump to force a period reload.

### `src/actions/` — 65 files, one action per file

Every file is `import { action } from '@uibakery/data'`, a single named
function returning `action(name, type, options)`, and a default export. Two
types are in use:

- **`'SQL'`** with `datasourceName: 'GAF Planilla DB'` and a `query` string.
  Parameters are `{{params.name}}` placeholders.
- **`'HTTP'`** with `datasourceName: 'Monday.com API'` (`pullMondayBoard`,
  `loadEmployeeDirectory`, `fetchMondayStartDates`).

Pages consume them with `useLoadAction` (read) and `useMutateAction` (write)
from `@uibakery/data`. Naming is consistent and should stay so: `load*`,
`upsert*`, `update*`, `delete*`, `save*`, `count*`. **Add a new file rather
than adding a second action to an existing one.**

### `src/app/lib/` — the shared logic

- **`classificationEngine.ts`** (35,657 bytes) — the engine, plus
  `computeDiscount`, `computeDerivedFields`, `getSchedule`, `isDst`,
  `formatTime12`, `parseTimeToMinutes`, `toLocalYMD`, `formatWorkDate`,
  `normalizeName`. Imported by `ProcessPayroll`, `ActionRequired`,
  `PayrollMaster` and `teramindParser` — changes here reach payroll pay.
- **`teramindParser.ts`** — SheetJS file parsing, identifier resolution
  (`buildFullTeramindResolver`, `resolveTeramindIdentifier`), wall-clock
  parsing, and grouping into `email → date → { entry, exit }`.
- **`attendanceStats.ts`** — pure aggregation over `v_attendance_daily` rows
  for the Attendance dashboard (`computeEmployeeStats`, `computeCompanyKpis`).

Other: `src/app/components/TimeInput.tsx`, `src/app/pages/attendance/*` (the
dashboard's five presentational components), `src/components/ui/*` (shadcn-style
primitives — do not modify), `src/lib/utils.ts` (`cn`).

---

## Hard constraints

**Schema changes.**
- No schema change without a migration file in `src/migrations/`. No `CREATE`,
  `ALTER` or `DROP` inside an action or a page.
- Migrations must be idempotent where they can be: `IF NOT EXISTS`,
  `ON CONFLICT DO UPDATE`, explicit `SET` rather than arithmetic on a column
  that may already have been shifted.
- A migration that mutates existing rows must state its scope (which periods,
  which rows), what it leaves alone, and how to reverse it. Follow the pattern
  in `1781400100`: a guard key, a `RAISE NOTICE` row count, and a commented
  revert block.
- A data migration must scope itself by period name and by the exact condition
  it is repairing. Do not rely on `resolved_by IS NOT NULL` to spare operator
  work — nothing writes that column, so it never excludes anything.
- **Never hand-edit `src/migrations/applied.txt`.** It is generated into the
  export and is already inconsistent with reality (14 entries against 46 rows
  in `uib_migrations`). Editing it fixes nothing and destroys evidence.
- `docs/recovered-migrations/` is a historical record of migrations that
  already ran. **Never re-run anything in it.**

**High-blast-radius files.** Edits in these have repeatedly damaged unrelated
code in the same file. Change the smallest possible region, never reformat, and
never let a change here ride along with an unrelated one:

| File | Bytes |
|---|---|
| `src/app/pages/ProcessPayroll.tsx` | 53,407 |
| `src/app/pages/PayrollMaster.tsx` | 42,934 |
| `src/app/pages/admin/AdminEmployeeSync.tsx` | 36,445 |
| `src/app/lib/classificationEngine.ts` | 35,657 |
| `src/app/pages/ActionRequired.tsx` | 34,154 |
| `src/app/pages/admin/AdminLookups.tsx` | 30,751 |

**Scope.**
- One coherent change per prompt. Bundled changes produce diffs nobody can
  review.
- Modify only the files named in the request. Creating, deleting or reformatting
  an unnamed file is a defect even if the requested change works — every export
  is diffed against the previous one and unexpected files are treated as
  collateral damage.
- Do not "clean up while you are in there". No drive-by renames, reordering, or
  formatting changes.

**Time and date logic.**
- Before touching anything involving a time, a date, a schedule, `late_minutes`,
  `discount_total_minutes`, or `v_attendance_daily`: **restate the timezone
  invariant, list every column the change touches, and state whether minute
  columns and statuses are recomputed.** If any of those cannot be stated
  precisely, stop and ask.
- Never add a timezone conversion. Never use `toISOString()` for a work date.
  Never call `teramindToPanama()`.

**Correctness.**
- `payroll_entries` holds real pay. A wrong number here becomes a wrong
  paycheque; it does not throw, and it does not appear in the logs. A clean log
  is not evidence of correctness.
- Never hardcode a value that already exists in `classification_config`,
  `schedules`, `holidays` or `dst_calendar`.
- Never hard-delete a `payroll_entries` row. Use the `deleted_at` / `deleted_by`
  soft-delete columns.
- Keep the string literals exact. `'Ausencia Justificada.'` has a trailing
  period and is matched by exact string in both `computeDiscount` and
  `v_attendance_daily`. `'Paid – Sin Compensatorio'` and `'Doctor Note – Pending'`
  use an en dash, not a hyphen. A one-character difference silently changes a
  discount or drops a row from the dashboard.

**This file.** `src/AGENTS.md` is authored outside UI Bakery and pasted in, then
round-trips back on the next export. Everything else under `src/` is owned by
UI Bakery. When a rule here stops matching the code, the rule is wrong — fix it
here rather than working around it.
