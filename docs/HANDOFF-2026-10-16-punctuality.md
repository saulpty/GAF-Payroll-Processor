# Handoff 2026-10-16: punctuality cleanup (Why tags, employee panel, List, filters)

`main` = see `git log -1`. Tests **923/924** (the one failing is L2, see below). Prompts:
`superpowers/prompts/2026-10-16-punctuality/` (decisions in `00-decisions.md`). Screenshots:
`docs/assets/2026-10-16-punctuality/`.

## On /dev, NOT released (waiting on Saul)

| What | Prompt |
|---|---|
| Why tags, everywhere they show (Activity, Needs a Look, Today, the panel): no "Tardiness" on a day the person arrived on time; red **Not Reported** when late with no form. One lateness rule: payroll's late minutes, else first Teramind record vs shift start (no grace). | 01 |
| Employee panel: no ring charts, no Status column; opened from Activity or Today it now includes the days payroll has not processed (Nichole Harris Wed Oct 14: Late 20 min, was "—"). | 02 |
| Attendance → List: "Punctuality by Employee", one sentence saying what it measures, 10 cards → 5 (Reports too: same component), 17 columns → 8. No number changed. | 03a, 03b, 03c, 03d |
| Filters: Periods/Dates and the range carry across Attendance tabs (Saul's "it resets" bug). | 04 |
| "Reported" comes from the forms on the List and the panel too, as on Reports and the Why tags. Sep 1 – Oct 15: List read 196 reported / 266 not, now 221 / 241 = Reports; absences 2 / 8 = Reports. 25 days, 12 people were wrong (Arelis Acosta 10 → 1 not reported). Pay untouched. See `findings/2026-10-16-reported-two-sources.md`. | 05, 05b |

Every export was compared with the prompts applied by script. 01, 02, 03a, 03b, 04 came back
byte-identical. **03c came back in UIB's own words** in two places (column explanations; "(3)"
instead of "3 Not Reported"); 03d put the exact text back and the file is now identical.

## Found on the way, not fixed

- **L2 fails: `src/actions/loadEmployeeCalendar.ts`** (Outlook calendar, Microsoft API datasource)
  arrived with the 01 export from earlier builder work. `'{{params.start}}'` and `'{{params.end}}'`
  sit inside quoted strings — the substitution trap from CHANGE-LOOP step 7. Committed as is
  (`f1e4167`); needs a prompt if that feature is meant to work.
- ~~"Reported" has two sources~~ — fixed by 05/05b the same day.
- Payroll's own Documentation column still holds the old snapshot for already-processed periods.
  Nothing on the Attendance pages reads it any more; Payroll Master / Action Required still show it.
- While checking 05b: a few minutes of "Couldn't load activity data" / "Couldn't check your
  access" across the app. Gone on reload — connection pressure, not a code fault.
- The panel's Late column shows "—" for a few seconds on live days until they load.
- Not Reported fires on 1 minute late (72 days in Oct 2–16, e.g. 9:01, 9:02). Accepted by Saul as
  how payroll counts lateness; revisit if managers find it noisy.

## Before releasing

1. Saul looks at /dev: List, Reports, Activity → a person, Today. Phone too.
2. Saul's go-ahead.
