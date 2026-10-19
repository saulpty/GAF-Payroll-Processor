# Payroll Master Period dropdown showed no periods (2026-10-19)

**Report (Saul):** the Period dropdown on Payroll Master offered only "Choose A Period" and
"All Periods". No real periods appeared.

## Evidence

- The dropdown is not in `PayrollMaster.tsx`. It is in the shared `src/app/FilterBar.tsx` (line 161),
  fed by `useLoadAction(loadPeriodsAction, [] as PeriodRow[])` (line 64).
- `loadPeriods.ts` takes no params, so the params-wrapper bug cannot apply. It reads every row of
  `periods` and is not viewer-scoped, so View As cannot empty it.
- Loaded live on 2026-10-19 in Chrome as Saul, by reading the dropdown's options from the page:
  - `/dev/.../payroll-master`: Choose A Period | All Periods | Q1-Oct-2026 | Q2-Sep-2026 | … | Q2-Mar-2026 (15 periods).
  - prod `/vitasya/jAaT7LYarG/payroll-master` (8.28.0): the same 15.
  So the failure does not reproduce on a normal load. Both versions are healthy right now.
- FilterBar throws away the loader's `loading` and `error` values (`[periodsRaw, , , refetchPeriods]`).
  If `loadPeriods` fails, `periodsRaw` stays `[]` and the dropdown shows exactly the two fixed options.
  Nothing retries: `refetchPeriods` runs only when `periodsVersion` changes, which happens after
  processing or deleting a period. It stays empty until a full reload.
- Failures like this are routine here. A full load fires many queries at once, and one
  intermittently fails (LESSONS: "Infrastructure errors vs real defects", "Release to staging
  first…"; HANDOFF-2026-10-16: Teramind card and Punctuality page both zero once, hard refresh fixed).

## Root cause

A transient `loadPeriods` failure, plus FilterBar silently treating "failed" as "no periods" and
never retrying. The data and the query are fine. The trigger is a connection-pressure blip. The
defect is the missing error handling.

**Confidence:** high on the mechanism (the code can only show those two options when the list is
empty). It was not reproduced live, so a failed request was not caught in the act.

## Also worth knowing

Q2-Oct-2026 (Oct 16–31) is not expected in this dropdown yet. The list shows processed periods only
(rows in `periods`). It appears once that period is processed.

## Fix

`docs/superpowers/prompts/2026-10-19-period-dropdown/01-period-list-retry.md`: up to 3 automatic
retries 2 s apart, and a visible "Loading periods…" / "Couldn't load periods, retrying…" line.
`FilterBar.tsx` only. Guard tests: `tests/periodListRetry.test.ts` PL1–PL3. On a scratch copy the
edits apply cleanly, PL1–PL3 pass, and the file is 14.1 KB.
