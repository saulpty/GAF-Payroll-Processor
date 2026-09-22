# Saturday Sep 19 was missing from the Teramind copy — and the pull log did not know (2026-09-22)

Saul: *"javier gonzalez sept 19 says no records, but i checked on teramind and there def are records
of him working."* He was right. Euclides Gonzalez (Teramind account `javier.g@passiontocarehc.com`
— one person, two names) worked 4h 29m that Saturday and the Hub showed "No Records".

## The evidence

Rows in `teramind_sessions` (`source = 'time_record'`) per day, read on 2026-09-22:

| work_date | records | employees | first synced |
|---|---|---|---|
| 2026-09-17 | 567 | 42 | Sep 18 |
| 2026-09-18 | 538 | 39 | Sep 18 |
| **2026-09-19 (Sat)** | **0** | **0** | **never** |
| 2026-09-20 (Sun) | 29 | 3 | Sep 21, 20:38 |
| 2026-09-21 (Mon) | 506 | 39 | Sep 22, 16:15 |
| 2026-09-22 (Tue) | 341 | 40 | Sep 22, 16:15 |

Saturday was the only hole in the last 16 days. Sep 12 and 13 (the previous weekend) hold 49 and 75
records for 5 and 6 people — small, but that is simply who works weekends.

## Cause 1 — the keep-fresh sync asks for two days and runs only when someone is watching

`keepFreshRange` returned **yesterday → today**, and `TeramindAutoSync` only fires while a super user
has the Hub open. Nobody opened it on Sat Sep 19 or Sun Sep 20. The first pull afterwards ran Monday
Sep 21 at 4:38 PM and asked for Sunday and Monday. **No pull ever asks for a day older than
yesterday, so Saturday could never come back.** Every quiet weekend leaves a permanent hole.

## Cause 2 — the pull log claims days that had not happened yet

`coversRange` treats a log entry as covering every day between `date_from` and `date_to`. The log
holds a **capture entered on Sep 17 for `2026-09-11 → 2026-09-25`** — eight days that did not exist
when it ran. So the log believed Sep 19 was covered.

That is the dangerous one. `TeramindSourceCard` asks exactly this question to decide whether to offer
Tim a **saved copy** of a period instead of a fresh capture. For Q2-Sep it would have said "saved
copy, pulled Sep 17" for a period missing an entire Saturday, and four people's real work would have
entered the engine as absences.

## What was done

1. **Backfilled Sep 19–20** from the Teramind tab (Re-Pull Periods Already Covered ticked, because
   the log wrongly believed the range was covered): 1,107 fetched, 59 saved. Sep 19 now reads
   Cemiriamiz Iglesias 8:56 AM · 9h 2m, Euclides Gonzalez 9:24 AM · 4h 29m (+24m), Michael Antonio
   Jones Roye 10:27 AM · 1h 4m (+87m). Edwin Broce still shows no records for that day — he was
   scheduled and nothing came back from Teramind, so that one is a real absence to ask about.
2. **Prompt `2026-09-22-weekend-gap/02`**: `keepFreshRange` now covers the **last seven days**
   (`KEEP_FRESH_DAYS`), so the first person to open the Hub after a weekend heals the gap, at the
   cost of one API call (a week is still a single chunk). And `coversRange` clamps every log entry to
   the day it actually ran, using a new `pulled_ymd` column (Eastern) on `loadTeramindPullLog`, so a
   forward-dated capture can never again be mistaken for coverage.

## What is still true after the fix

The sync still only runs **in a browser**. A week-wide window means a gap heals as soon as any super
user opens the Hub, but if nobody opens it for more than seven days the hole returns, and Today will
keep showing "No Records" for real work until someone does. The only real fix is the server-side
**Automations** project with the VP — this is the second concrete cost of not having it.

Payroll itself is safer than it looks: **Capture From Teramind pulls the whole period fresh from the
API**, so a capture run after the period ends fills any gap. The risk was entirely in being offered
the *saved copy* instead, which cause 2 now prevents.
