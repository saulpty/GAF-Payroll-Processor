# Stray early Teramind records ("ghost records") — frozen contract (2026-09-18, evening)

Approved by Saul 2026-09-18: "if someone's entry was 6am and allegedly worked for 5 mins and then
nothing til 8am that's for sure an error … U have my ok and u can flag those just in case so Tim
can check." Applies to live views AND the payroll capture. No Panama-time switch (declined).

## Evidence

Fri 2026-09-18: Nichole Harris, Charis Dixon, Monique Luque, Yessenia Moran each have a first Time
Record at exactly 06:24 Eastern, under a minute long, then nothing for 137–177 minutes; real work
starts 08:41–09:21. Nichole (real start 09:21, Tardiness form on file) showed "On Time". Last 90
days: 23 of 2,477 employee-days look like this; 8 hid a late arrival.

## The rule (single source of truth: a SQL view)

For one employee on one `work_date`, order the Time Records by `started_et`. Let `day_start` be the
first `started_et`. A record is the **cut** when ALL hold:
1. a later record exists that day,
2. `finished_et − day_start ≤ teramind_ghost_max_minutes` (default **5**),
3. `next.started_et − finished_et ≥ teramind_ghost_gap_minutes` (default **60**).
Every record up to and including the (last) cut is a **ghost**: `is_ghost = true`. Ghost records are
excluded from entry, exit, active time, record counts and gap maths everywhere. Days with a single
record are never ghosts. Settings live in `classification_config`, category `teramind`.

View: `public.v_teramind_records` = every `teramind_sessions` row with `source = 'time_record'` and
`employee_id IS NOT NULL`, all original columns plus `is_ghost boolean`. It must be written so that
a `WHERE work_date BETWEEN …` / `employee_id IN …` predicate on the view is pushed below the window
functions (partition keys are `employee_id, work_date`; no CTE referenced twice, no MATERIALIZED).

## Actions that switch to the view (each keeps its scoping and integer-only outputs)

| Action | Change |
|---|---|
| `loadTeramindDayPunches` (Today) | aggregates over `NOT is_ghost`; new column `ghost_min int` = minutes since midnight of the earliest ghost `started_et` that day, `NULL`→ return `-1` when none |
| `loadTeramindActivityDays` (Activity) | same; new `ghost_min int` (−1 when none) |
| `loadTeramindPunchDays` (payroll capture) | same; new `ghost_min int` (−1 when none) and `display_name text` |
| `loadTeramindVsPayroll` (comparison) | reads the view with `NOT is_ghost`; no new column |

A day whose only records are ghosts cannot exist (rule 1 guarantees a later record).

## Lib

`src/app/lib/activityDays.ts` is 15,002 bytes (cap 15,360). Split first: move every exported **type**
to a new `src/app/lib/activityTypes.ts`; `activityDays.ts` re-exports them
(`export type { … } from './activityTypes'`) so no import elsewhere changes. Then add
`ghost_min: number` to `ActivityDayRow` and `ghostMin: number | null` to `ActivityDay` (null when
`ghost_min < 0` or missing). No other behaviour change. Both files pure, `import type` only.

## UI (Title Case)

- Entry cells (Today, Activity By Day, Activity expanded days, panel Day By Day): the entry shown is
  the clean one; when `ghostMin !== null` add a small muted marker under/next to it:
  `Early Record 6:24 AM Ignored`, with a tooltip: "A Teramind record of a few minutes followed by
  an hour or more of nothing is treated as a computer event, not an arrival."
- Process Payroll → Capture card (`TeramindSourceCard.tsx`, NOT `ProcessPayroll.tsx`): after a
  capture, an amber block "Early Stray Records Ignored — N" listing `Name · Fri Sep 18 · Ignored
  6:24 AM → Entry 9:21 AM`, plus one muted line: "Check These Before Running. The backup file upload
  does not apply this rule." `ApiCapture` gains `ghostDays: number` (flows into the run snapshot
  through the existing `capture` object; `ProcessPayroll.tsx` is not edited).

## Guards

`teramindGuards.test.ts`: the four actions read `v_teramind_records` and none reads
`teramind_sessions` directly any more; the view migration exists; lib files < 15 KB, pure.
