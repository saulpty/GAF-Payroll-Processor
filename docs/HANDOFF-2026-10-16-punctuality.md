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

Every export was compared with the prompts applied by script. 01, 02, 03a, 03b, 04 came back
byte-identical. **03c came back in UIB's own words** in two places (column explanations; "(3)"
instead of "3 Not Reported"); 03d put the exact text back and the file is now identical.

## Found on the way, not fixed

- **L2 fails: `src/actions/loadEmployeeCalendar.ts`** (Outlook calendar, Microsoft API datasource)
  arrived with the 01 export from earlier builder work. `'{{params.start}}'` and `'{{params.end}}'`
  sit inside quoted strings — the substitution trap from CHANGE-LOOP step 7. Committed as is
  (`f1e4167`); needs a prompt if that feature is meant to work.
- **"Reported" has two sources.** The panel's small numbers / List counts read payroll's
  `documentation` field; the Why tags read the forms. Nichole Harris: 3 late days, all with a
  Tardiness form, yet "1 Unreported" (Oct 2, official). Pre-existing.
- The panel's Late column shows "—" for a few seconds on live days until they load.
- Not Reported fires on 1 minute late (72 days in Oct 2–16, e.g. 9:01, 9:02). Accepted by Saul as
  how payroll counts lateness; revisit if managers find it noisy.

## Before releasing

1. Saul looks at /dev: List, Reports, Activity → a person, Today. Phone too.
2. Saul's go-ahead.
