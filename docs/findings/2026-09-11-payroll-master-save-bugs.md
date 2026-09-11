# Payroll Master: four reports, three defects and one data quirk (2026-09-11)

Saul's reports, editing Q1-Jun-2026 rows in Payroll Master. Investigation was
read-only; every conclusion below is a line in the exported source, not a guess.

## The reports

1. No way to cancel an edit except changing tabs.
2. Carlos Aloma 6/3: punches deleted, events cleared, discount went to 0 but
   Late min (13) and Early min (132) stayed.
3. After a successful save the Save button stays.
4. Luis Abad 6/1: 4:50 AM → "12:35am", 985 early minutes. Exit set to 4:00 PM,
   event none, saved: still RED, still 985, Save still showing.

## Root causes

| Report | Defect | Evidence |
|---|---|---|
| 3 | `handleSave` writes and reloads but never removes `edits[row.id]`; `isDirty` is `!!edits[id]`, so the row stays dirty forever. The ✓ branch (`saved && !dirty`) is unreachable. A second Save click is a no-op because `fieldsDirty` compares the edit against the reloaded row and returns. Present since the initial commit. | `src/app/pages/PayrollMaster.tsx:190, 192-240, 647-657` |
| 2 | `updateEntryExit.ts` writes only `entry_time`/`exit_time`. Both pages pass the stored `late_minutes`, `late_after_grace`, `early_leave_minutes` into `computeDerivedFields`, so discount and status derive from stale minutes. The only minutes-from-punches formula is inline in the engine run; the edit path never calls it. | `src/actions/updateEntryExit.ts`; `PayrollMaster.tsx:206-219`; `ActionRequired.tsx:214-233`; `classificationEngine.ts:690-697` |
| 4a | `processTeramindData` keys a session by its start date and takes `max(exit)`, so a session crossing midnight leaves an exit `Date` on the next day. The engine reads only `getHours()*60+getMinutes()` → exit 00:35 → early = 17:00 − 00:35 = 985. Luis's 6/2 entry is 12:35 AM and 6/3 is 12:06 AM: his machine is active past midnight. | `teramindParser.ts:196-207`; `classificationEngine.ts:693` |
| 4b | "12:35am" (lowercase, no space) is not `formatTime12` output. `TimeInput`'s blur formatter matches that spelling but then splits on whitespace, gets no meridiem and throws; the raw text typed by hand is what gets saved. | `src/app/components/TimeInput.tsx:29-33` |
| 4c | After the 4:00 PM edit: report 2 kept 985, report 3 kept Save, and `computeDerivedFields` returns `initial_status` whenever `event_type_1` is empty, so "none" cannot turn a RED row GREEN. Saul's decision 2026-09-11: keep that rule. | `classificationEngine.ts:304-315` |
| 1 | Missing feature. `edits` is cleared only by the global period/employee effect or on unmount; no shared unsaved-changes helper exists in `src/`. | `PayrollMaster.tsx:121-127`; `ActionRequired.tsx:149-156` |

## Blast radius of writing minutes from the pages

- Only `upsertPayrollEntries.ts` writes the minute columns today. No triggers,
  functions, CHECK constraints or views recompute them. Nothing snapshots or
  diffs `late_minutes` after a run. Safe to write.
- Readers that will show corrected numbers: `v_attendance_daily` (stored
  `late_minutes`, migration `1781995000` line 29), `loadAttendanceReportDays`,
  `attendanceReport.ts` verdicts, HRK Summary discount total, Period Log.
- Unchanged, worth knowing: blanking `entry_time` drops the day from the
  Attendance dashboard and flips the PTO "worked/off" flag. A payroll re-run
  overwrites every column, including operator-corrected punches
  (`upsertPayrollEntries.ts:24-45`, no guard).
- A garbage time string is a hard parse error in the view
  (`to_timestamp(…,'HH12:MI AM')`), so Save must refuse anything that is not
  `H:MM AM/PM`.

## Decisions (Saul, 2026-09-11)

- No auto-green: a corrected clean row still needs an event and pay impact.
- Blank Entry → late 0; blank Exit → early 0.
- Fix both Payroll Master and Action Required.

Fix sequence: `docs/superpowers/prompts/2026-09-11-payroll-save-bugs/`.
