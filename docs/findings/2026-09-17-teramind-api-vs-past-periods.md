# Teramind API vs every past payroll period — does the API give payroll the same punches?

**Date:** 2026-09-17. **Question (Saul):** before payroll stops using an uploaded Teramind file and
reads the Teramind API instead, prove the API gives the same entry/exit times payroll already has.
**Method:** look backwards. All 12 processed periods (Q2-Mar-2026 → Q1-Sep-2026) were pulled from
the API into `teramind_sessions`, then compared day by day with `payroll_entries` on the read-only
screen *Admin → Employees → Teramind → Teramind vs Payroll* (`/dev`, draft, not released).
Nothing in `payroll_entries` was written or changed.

## Answer

**Yes — when the right Teramind feed is used.** Teramind's **Time Records** feed (the screen Tim has
always exported the file from) reproduces payroll's times to the minute. The login-session feed the
VP's app uses does not, and must not be used for payroll.

| Feed | Period | Days with times on both sides | Match to the minute |
|---|---|---|---|
| Login sessions | Q1-Sep-2026 | 362 | **33.4%** — 159 further days had payroll times and no session at all; 123 sessions ran over 16 h |
| **Time Records** | Q2-Aug-2026 | 447 | **99.6%** (445) — the 2 differences are rows edited in payroll |
| **Time Records** | last five periods (Q1-Jul → Q1-Sep) | 2,039 | **99.6%** (2,031) |
| **Time Records** | all 12 periods | 4,686 | **96.0%** exact (4,498), 96.9% within 5 minutes |

Entry time alone — the number lateness is calculated from — is **exact on 4,621 of 4,686 days (98.6%)**.

## All 12 periods, Time Records — 5,663 employee-days

| Verdict | Days | What it is |
|---|---|---|
| Match to the minute | 4,498 | — |
| Within 5 minutes | 41 | — |
| Different | 147 | **112 of them were changed in payroll after the run** (hand corrections). **90 differ on the exit only**, entry agreeing — the pattern of a period run on its last day, where payroll filled the exit from the schedule while Teramind kept recording. 31 differ on both. |
| Payroll has times, Teramind has none | 110 | **73 are 2026-05-15 and 2026-05-18** — the Teramind outage days; Period Log's own note says payroll used the default schedule. The rest are a handful per period, mostly Q2-Mar. |
| Teramind has times, payroll has none | 342 | 132 have a payroll row labelled PTO / Feriado / Permiso Remunerado / Ausencia Justificada — payroll clears times on time-off days by design. 210 have no payroll row at all: **93 are Timothy Moore** (not on payroll until Q1-Sep), the rest (Alisha Dua 16, Isaac Chung 16, Samuel Duarte 13, Reggina Sandoval 12, …) have not been examined one by one — most likely days off with some activity, from before the 2026-08 rule that such days get a YELLOW row. |
| No punches on either side | 525 | Absences, time off — both sides agree. |
| Records over 16 hours | 0 | The "8-day session" problem exists only in the login-session feed. |
| Days with hand-typed Teramind time | 0 | `is_manual` is saved and shown for the day it appears. |

Per period (match / within 5 / different / payroll-only):
Q2-Mar 347/1/37/24 · Q1-Apr 382/10/24/0 · Q2-Apr 299/11/24/0 · Q1-May 376/0/6/0 · Q2-May 291/0/1/74 ·
Q1-Jun 415/4/32/5 · Q2-Jun 357/15/15/5 · Q1-Jul 391/0/3/0 · Q2-Jul 321/0/0/0 · Q1-Aug 356/0/2/0 ·
Q2-Aug 445/0/2/0 · Q1-Sep 518/0/1/2.
The older periods are noisier because they were run on the last day (mid-day pulls) and were
hand-corrected more; from Q1-Jul on, periods were run the morning after and agree almost perfectly.

## What had to be true for the numbers to come out

1. **The right feed.** `POST /tt/r/time-records/grid` through the `Teramind API` datasource. Found
   because Saul pointed at Teramind's Time Records screen. Live for today, filtered to our agents,
   exact instants.
2. **Linking history, not just today's roster.** With only active employees and live accounts linked,
   873 days showed "payroll only". Linking the **9 former employees** and **18 deleted Teramind
   accounts** (replaced laptops, machine-name accounts) brought it to 110. Ten people have more than
   one account; all are linked (54 employees, 64 accounts).
3. **De-duplication.** Teramind can return the same row twice in one response; the save step
   de-duplicates each batch (guard test T8).
4. **Time handled once.** Instants → US-Eastern clock text in `teramindTime.ts` only; the comparison
   is done in SQL on whole minutes because the database layer rewrites date-looking text.

## Open items before payroll switches (Phase D) — for Saul

- Go / no-go on switching Process Payroll's step 2 to "Capture from Teramind" (upload kept as an
  emergency backup). The evidence above supports **go**.
- Decide what a capture should do on **outage days** (2026-05-15/18 style): today Tim types outage
  dates in step 3 and the engine uses the default schedule — that keeps working unchanged.
- The 210 "Teramind only, no payroll row" days: 93 are explained (Timothy Moore); the other 117 deserve
  a ten-minute look with Tim before they are called informational.
- Still true and still out of scope: a re-run overwrites reviewed rows; paid periods are not locked.

## How to reproduce

`/dev` → Admin → Employees → Teramind → *Teramind vs Payroll* → pick a period or **All Periods**,
Source = **Time Records**. Filters and Export CSV are on the card. Switch Source to **Login Sessions**
to see why that feed was rejected.
