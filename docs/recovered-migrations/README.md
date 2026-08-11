# Recovered migrations

A plain-language explanation. See `docs/findings/2026-08-11-schema-reconciliation.md`
for the full investigation this came out of.

---

## What these files are

Every change ever made to the database's structure — adding a column,
fixing a view, creating a table — is supposed to leave behind a small `.sql`
file in `src/migrations/`, plus a line in `src/migrations/applied.txt`
recording that it ran. That's the paper trail.

We found the database itself keeps its own paper trail too, in a table
called `uib_migrations`, and it doesn't agree with the paper trail in this
repository. The database's own record is longer: it lists 46 changes that
ran, but this repo only has files for 35 of them, and `applied.txt` only
lists 14.

That means **11 changes ran against the real database with no file
anywhere recording what they did.** If we ever needed to rebuild this
database from scratch using only what's in the repo, those 11 changes
would be silently missing.

The 11 `.sql` files in this folder are those changes, recovered by reading
them directly out of the database's own record and writing them back out
to disk — so the history is preserved even though it was never filed
properly the first time.

## Why they are not in `src/migrations/`

`src/migrations/` is not a place we write files by hand. It's an exact
copy of whatever UI Bakery's own export contains, and every time we pull a
fresh export, anything in `src/` that the export doesn't include gets
deleted to keep the copy exact. A file placed there manually would survive
only until the next export — then vanish again.

So these 11 files live in `docs/recovered-migrations/` instead, a folder
nothing ever overwrites.

## They have already run. Never re-run them.

Every file in this folder starts with a header saying so, but it bears
repeating here: **these migrations are already applied to the live
database.** They are a historical record, not a to-do list. Running any of
them again would either error (for the ones that create a table) or
silently redo work that's already done (for the ones that redefine a
view) — neither is useful, and neither is needed.

## Nine of these define the Attendance dashboard's view

Nine of the eleven files (the ones named `..._fix_v_attendance_daily_...`
or `..._fix_view_...`) are, in order, every fix ever made to a database
view called `v_attendance_daily`. That view is what the entire Attendance
dashboard reads from — attendance status, lateness minutes, on-time rate,
all of it comes from this one view.

Before this recovery, the *current, correct* definition of that view
existed only inside the database itself — nowhere in the repository. If
anyone had tried to reconstruct the database from the repo alone, they'd
have gotten an early, buggy version of this view (or none at all), losing
real fixes: correct time-format parsing, correct late/on-time
classification, a fixed date format, and daylight-saving-time correctness
for the Panama/US-Eastern time difference.

## The eleven, in the order they ran

| Migration ID | Applied at (UTC) | What it does |
|---|---|---|
| `1781280100_fix_v_attendance_daily_time_parser` | 2026-06-15 15:12:23 | Fixes how the Attendance view reads clock-in times: adds correct handling for "12:xx AM/PM" and for 24-hour "HH:MM:SS" times, using the time format Postgres parses correctly. |
| `1781280200_fix_v_attendance_daily_tardanza_status` | 2026-06-15 16:07:35 | Fixes the Attendance view so a lateness that was properly reported ("Tardanza") always shows as "Late - Reported," even when the calculated minutes-late rounds to zero. This alone corrected 554 rows that had been wrongly shown as "On Time." |
| `1781280300_fix_v_attendance_daily_classification` | 2026-06-15 16:51:32 | Rewrites the Attendance view's rules: company holidays and full-day excused absences (PTO, justified/unjustified absence) are now left out of the view entirely, instead of appearing as a misleading "Excused" row. |
| `1781280400_fix_view_use_db_late_minutes` | 2026-06-15 18:45:36 | Fixes the recorded shift start time (was wrongly stored as 9:00 AM, corrected to 8:00 AM) and changes the Attendance view to use the lateness-in-minutes value the payroll engine already calculated, instead of recalculating it a second, less reliable way. |
| `1781290000_fix_view_date_as_text` | 2026-06-16 14:55:44 | Rebuilds the Attendance view so its date column comes out as plain text instead of a database date value (needed because the column's type had to change, which required dropping and recreating the view). |
| `1781290100_fix_view_date_column_format` | 2026-06-16 15:03:01 | Fixes the date column, which was still showing up as a full timestamp instead of a plain date despite the previous fix; switches to a more explicit text conversion. |
| `1781290200_fix_view_dual_time_format` | 2026-06-16 15:15:57 | Adds support for a second clock-in time format found in the real data ("10:50:00," 24-hour, no AM/PM) alongside the original "8:03 AM" format, so both parse correctly. |
| `1781290300_fix_view_date_tochar` | 2026-06-16 15:16:43 | Fixes the date column a third time — it was still arriving in the app as a full timestamp instead of a plain date because of how the database driver serializes dates; forces a plain "YYYY-MM-DD" string instead. |
| `1781290400_fix_view_dst_aware` | 2026-06-16 15:22:08 | Makes the Attendance view daylight-saving-time aware. Clock-in times come from Teramind in US Eastern time; this fix converts them to Panama time correctly whether or not the US is currently observing daylight saving. |
| `1781402200_create_pto_tables` | 2026-07-22 18:08:08 | Creates three new tables (`pto_employees`, `pto_approvals`, `pto_floating_holidays`) for a paid-time-off tracking feature. |
| `1781402300_deactivate_personal_email_duplicates` | 2026-08-06 19:10:23 | Deactivates 4 duplicate employee records that had been created using personal email addresses, since each of those 4 people already has a correct record under their work email. |

Applied-at times are shown exactly as recorded in the database's
`uib_migrations` table.

## About `1781402200_create_pto_tables`

The three tables this migration creates are not read or written by any
page or backend action in this app today (confirmed by searching the code
— see the reconciliation findings doc for the exact search and result).
They are scaffolding left over from a PTO-tracking feature that was
started and then set aside; the owner has confirmed it will be rebuilt
from scratch rather than resumed from these tables. They are harmless
sitting unused, so no action is being taken on them now — see the findings
document for the recommendation.
