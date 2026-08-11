# Schema and migration reconciliation — 2026-08-11

Source: `uib_migrations`, read directly from the GAF Planilla DB and
extracted to `Downloads\gaf-recovered-migrations.json` (11 rows, 40,745
bytes — `migration_id`, `name`, `checksum`, `applied_at`, `applied_by`,
`sql_content`). Schema and migration text only; no employee-level data is
recorded in this document.

This supersedes the interactive query plan in `docs/sql/schema-audit.sql`
(Q1–Q7): rather than pasting query results back and forth, the full
`uib_migrations` ledger was exported once and reconciled offline. The
query pack remains valid and is left in place for any future audit of this
kind.

## The three counts

Three different places claim to say what migrations have run against this
database, and they disagree:

| Source | Count |
|---|---|
| `uib_migrations` (the database's own ledger) | **46 rows** |
| `.sql` files in `src/migrations/` | 35 files |
| Entries in `src/migrations/applied.txt` | 14 entries |

**`uib_migrations` is authoritative.** It is written by UI Bakery itself at
the moment a migration actually executes against the real database. The
repo's two artifacts are downstream copies — `src/migrations/*.sql` is
whatever UI Bakery's export currently contains, and `applied.txt` is a
log file bundled into that same export. Both can fall out of sync with
what the database actually did; the database's own record of what it did
cannot.

Reconciling the 46-row ledger against the repo:

- **11 migrations ran against the database with no `.sql` file anywhere in
  the repo.** These are the files recovered into
  `docs/recovered-migrations/` by this task (list below).
- **0 files in the repo were never applied.** Every `.sql` file that exists
  in `src/migrations/` has a corresponding row in `uib_migrations` — there
  is no file sitting in the repo waiting to run, and nothing UI Bakery
  would treat as pending.

## Root cause (inferred, not confirmed)

**This is a probable explanation, not a verified fact.** Nobody has
confirmed it against UI Bakery's own project history; it is inferred from
the evidence below.

`version.yml` in the current export reads:

```
projectName: GAF HR Hub
uiBakeryVersion: 3.192.0-rc.0
```

A previous local copy of this project (still present on disk at
`.claude\worktrees\gaf-hr-hub-local-92331a\version.yml`, from before this
workspace was set up) reads:

```
projectName: Payroll Processor
uiBakeryVersion: 3.181.0
```

The likely sequence: the UI Bakery project was originally called *Payroll
Processor*, and at some point was cloned or renamed into *GAF HR Hub*
(version 3.181.0 → 3.192.0-rc.0 along the way). The 11 missing migrations
all predate or fall inside that transition — nine of them (2026-06-15 and
2026-06-16) are early view fixes, and the other two (2026-07-22 and
2026-08-06) come later. Migration `.sql` files that had been created
during development were not all carried into the renamed/cloned project,
and `applied.txt` — which is bundled into the export fresh each time —
did not carry the older history forward either. That would explain both
gaps at once: the missing files and the truncated `applied.txt` (which
jumps straight from `1781275100` on 2026-06-12 to `1781803200` on
2026-08-07, skipping everything in between even though most of those
`.sql` files *are* present on disk).

What this does not explain, and what keeps this inferred rather than
confirmed: exactly *why* those particular 11 files were dropped while 35
others survived the transition intact. Nothing in the repo answers that.

## Consequence

**No migration is pending.** Because 0 repo files are missing from
`uib_migrations`, there is nothing sitting in `src/migrations/` that UI
Bakery would treat as unapplied and try to run. Nothing will unexpectedly
re-run against the live database from anything currently in the repo.

**The real exposure was `v_attendance_daily`.** Nine of the eleven missing
migrations are sequential fixes to that one database view, which is what
the entire Attendance dashboard reads from. Because none of those nine
had a file in the repo, the view's *current, correct* definition existed
only inside the database — nowhere on disk. Had anyone ever tried to
rebuild this database from the repository alone (a fresh environment, a
disaster-recovery scenario, or simply reading the repo to understand the
view's behavior), they would have silently ended up with an early, buggy
version of `v_attendance_daily` — or no view at all — missing real,
already-shipped fixes: correct parsing of two different clock-in time
formats, correct classification of reported lateness that rounds to zero
minutes, exclusion of holidays and full-day absences from the view,
correct plain-text date formatting, and daylight-saving-time-aware
conversion between Teramind's US Eastern timestamps and Panama local time.
That gap is now closed by the recovery in `docs/recovered-migrations/`.

## The eleven recovered migrations

| Migration ID | Applied at (UTC) |
|---|---|
| `1781280100_fix_v_attendance_daily_time_parser` | 2026-06-15 15:12:23 |
| `1781280200_fix_v_attendance_daily_tardanza_status` | 2026-06-15 16:07:35 |
| `1781280300_fix_v_attendance_daily_classification` | 2026-06-15 16:51:32 |
| `1781280400_fix_view_use_db_late_minutes` | 2026-06-15 18:45:36 |
| `1781290000_fix_view_date_as_text` | 2026-06-16 14:55:44 |
| `1781290100_fix_view_date_column_format` | 2026-06-16 15:03:01 |
| `1781290200_fix_view_dual_time_format` | 2026-06-16 15:15:57 |
| `1781290300_fix_view_date_tochar` | 2026-06-16 15:16:43 |
| `1781290400_fix_view_dst_aware` | 2026-06-16 15:22:08 |
| `1781402200_create_pto_tables` | 2026-07-22 18:08:08 |
| `1781402300_deactivate_personal_email_duplicates` | 2026-08-06 19:10:23 |

Recovered `.sql` bodies, provenance headers, and one-line descriptions of
what each does are in `docs/recovered-migrations/` (see its `README.md`
for the full table). All 11 files were verified to exist and each
recovered file's SQL body matches the `sql_content` byte-length recorded
in the source export exactly — see `.superpowers/sdd/task-6-report.md`.

## The `pto_*` tables

`1781402200_create_pto_tables`, applied **2026-07-22 18:08:08**, created
three tables: `pto_employees`, `pto_approvals`, `pto_floating_holidays`
(a PTO tracker: per-employee PTO caps, a leave-request/approval log, and
a floating-holiday allocation tracker — see the migration's SQL in
`docs/recovered-migrations/1781402200_create_pto_tables.sql`).

**Referenced anywhere in application code? No.** Verified by grep:

```
$ grep -rn "pto_approvals\|pto_employees\|pto_floating_holidays" src/actions src/app
(no output — no matches)

$ grep -rn "pto_approvals\|pto_employees\|pto_floating_holidays" src/
src/migrations/1781803200_fix_directory_sync_emails_and_duplicates.sql:29:DELETE FROM pto_employees          WHERE employee_id IN (44, 53);
src/migrations/1781803200_fix_directory_sync_emails_and_duplicates.sql:30:DELETE FROM pto_approvals          WHERE employee_id IN (44, 53);
src/migrations/1781803200_fix_directory_sync_emails_and_duplicates.sql:31:DELETE FROM pto_floating_holidays  WHERE employee_id IN (44, 53);
```

The only mentions anywhere in `src/` are three `DELETE` statements inside
a later, unrelated duplicate-employee cleanup migration — no page, action,
or query in `src/actions/` or `src/app/` reads or writes any of these
three tables. (A broader grep for the substring `pto_` does hit many
results in `src/actions/loadHrkSummary.ts`, `src/app/pages/HrkSummary.tsx`,
and others — but those are all column names and CTE aliases like
`pto_days`, `pto_dates`, `pto_count` derived from the `PTO` *event type*
already recorded on `payroll_entries`, which is a completely separate,
long-standing feature and has nothing to do with these three tables.)

**Origin:** abandoned scaffolding. The owner has confirmed this was the
start of a PTO-tracking feature that was set aside and will be **rebuilt
from scratch** rather than resumed from this schema. (Source: the owner,
directly, in the working session of 2026-08-11 — this claim is not backed
by any artifact elsewhere in this repository.)

**Decision: document only, for now.** Do not drop these tables today.
Dropping a table is irreversible, and these three are empty of any live
application dependency — they are harmless exactly where they sit.
Recommend dropping `pto_employees`, `pto_approvals`, and
`pto_floating_holidays` **as part of that future PTO rebuild**, at the
point a decision is made on the new schema, rather than as a standalone
cleanup now.

## Verified-applied spot checks

Three migrations were spot-checked to confirm the repo and the database
ledger agree on migrations *other* than the 11 missing ones — i.e. that
the reconciliation above (0 files unaccounted for) actually holds:

- `1781402000_add_work_days_to_schedules.sql` — **present** in
  `src/migrations/`. Since the database ledger has 46 rows and only 11
  are missing a repo file (all 11 identified above; this migration is not
  among them), and 0 repo files are missing a ledger row, this file's
  presence on disk places it in the 46-row `uib_migrations` ledger.
- `1781402100_add_soft_delete_to_payroll_entries.sql` — **present** in
  `src/migrations/`, same reasoning: in the ledger.
- `1781401000_create_hrk_exports_table.sql` — **present** in
  `src/migrations/`, same reasoning: in the ledger.

All three are confirmed in `uib_migrations`.

## Actions arising

1. **Done, this task.** Recover the 11 migrations into
   `docs/recovered-migrations/` so `v_attendance_daily`'s full history is
   no longer database-only.
2. **Deferred, future PTO rebuild.** Drop `pto_employees`, `pto_approvals`,
   `pto_floating_holidays` when the PTO feature is rebuilt — not now.
3. **No action needed.** `applied.txt` is not to be edited or "fixed" — it
   is a UI Bakery export artifact under `src/`, which is a mirror, and it
   is not evidence that anything is unapplied.
