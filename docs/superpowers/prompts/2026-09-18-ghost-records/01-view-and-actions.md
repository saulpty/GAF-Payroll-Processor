# 01 — Ghost records: one view, four actions

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`. Never create a
top-level folder named `src`.**

## Files that may change

- `src/migrations/1782012000_teramind_ghost_records.sql` — NEW, content below, character for
  character. **Apply it.**
- `src/actions/loadTeramindDayPunches.ts` — REPLACE with the content below, character for character.
- `src/actions/loadTeramindActivityDays.ts` — REPLACE with the content below, character for character.
- `src/actions/loadTeramindPunchDays.ts` — REPLACE with the content below, character for character.
- `src/actions/loadTeramindVsPayroll.ts` — REPLACE with the content below, character for character.

No other file may be touched. Never edit `ProcessPayroll.tsx`, `PayrollMaster.tsx`,
`ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything
under `src/components/ui/`. No page, lib or type changes in this prompt: the two new output columns
(`ghost_min`, `display_name`) are simply ignored by the screens until the next prompt reads them.

## Why

On Fri 2026-09-18 four people — Nichole Harris, Charis Dixon, Monique Luque, Yessenia Moran — each
had a first Teramind Time Record at exactly 06:24 Eastern, under a minute long, then nothing for
137–177 minutes; their real work started 08:41–09:21. The Today board therefore showed Nichole "On
Time" when she actually arrived at 9:21. Over the last 90 days 23 of 2,477 employee-days look like
this and 8 of them hid a late arrival.

A Teramind record of a few minutes followed by an hour or more of nothing is a computer event, not
an arrival. The rule lives in **one SQL view**, `public.v_teramind_records`, so the Today board, the
Activity tab, the payroll capture and the comparison screen can never disagree about it. The four
actions below stop reading `teramind_sessions` and read the view instead, counting only rows where
`is_ghost` is false. Two settings in `classification_config` (category `teramind`) control it, so no
number is hardcoded in a page.

## 1. Verbatim files

### `src/migrations/1782012000_teramind_ghost_records.sql`

Apply this migration. It is safe to run twice.

```sql
-- Stray early Teramind records ("ghost records").
--
-- Fri 2026-09-18: four people had a first Time Record at exactly 06:24 Eastern, under a minute
-- long, then nothing for 137-177 minutes; real work started 08:41-09:21. One of them showed
-- "On Time" on the Today board while she actually arrived at 9:21. A Teramind record of a few
-- minutes followed by an hour or more of nothing is a computer event, not an arrival.
--
-- The rule, for one employee on one work_date with the records ordered by started_et: a record is
-- the "cut" when (1) a later record exists that day, (2) it finishes within
-- teramind_ghost_max_minutes of the first start of the day, and (3) the next record starts at
-- least teramind_ghost_gap_minutes after it finished. Every record up to and including the LAST
-- cut is a ghost. A day with a single record can never hold a ghost, and the last record of a day
-- is never a ghost (rule 1 needs a later one), so this can never empty out a day.
--
-- Written as nested sub-selects - no CTE referenced twice, nothing materialised - and every window
-- is partitioned by (employee_id, work_date), so a WHERE work_date = ... or employee_id IN ...
-- written against the view is pushed below the window functions and still uses the indexes.
-- Safe to run twice.

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES (
  'teramind_ghost_max_minutes',
  '5',
  'Ghost record: longest stray first record (minutes)',
  'A Time Record that finishes within this many minutes of the first start of the day is short enough to be a stray computer event rather than an arrival. It only counts as one when the quiet gap in teramind_ghost_gap_minutes follows it.',
  'number',
  'teramind'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES (
  'teramind_ghost_gap_minutes',
  '60',
  'Ghost record: quiet gap that must follow (minutes)',
  'A short first record is only ignored when the next Time Record starts at least this many minutes after it finished. An hour of nothing after a few minutes of activity is not a work day starting.',
  'number',
  'teramind'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE VIEW public.v_teramind_records AS
SELECT g.id,
       g.agent_id,
       g.employee_id,
       g.work_date,
       g.started_et,
       g.finished_et,
       g.started_raw,
       g.duration_s,
       g.computer,
       g.raw,
       g.synced_at,
       g.source,
       g.is_manual,
       (g.cut_rn IS NOT NULL AND g.rn <= g.cut_rn) AS is_ghost
FROM (
  SELECT c.id, c.agent_id, c.employee_id, c.work_date, c.started_et, c.finished_et,
         c.started_raw, c.duration_s, c.computer, c.raw, c.synced_at, c.source, c.is_manual,
         c.rn,
         MAX(CASE WHEN c.is_cut THEN c.rn END)
           OVER (PARTITION BY c.employee_id, c.work_date) AS cut_rn
  FROM (
    SELECT w.id, w.agent_id, w.employee_id, w.work_date, w.started_et, w.finished_et,
           w.started_raw, w.duration_s, w.computer, w.raw, w.synced_at, w.source, w.is_manual,
           w.rn,
           (
             w.next_started_et IS NOT NULL
             AND EXTRACT(EPOCH FROM (w.finished_et::timestamp - w.day_start::timestamp))
                 <= 60 * COALESCE((SELECT NULLIF(BTRIM(k.value), '')::numeric
                                   FROM public.classification_config k
                                   WHERE k.key = 'teramind_ghost_max_minutes'), 5)
             AND EXTRACT(EPOCH FROM (w.next_started_et::timestamp - w.finished_et::timestamp))
                 >= 60 * COALESCE((SELECT NULLIF(BTRIM(k.value), '')::numeric
                                   FROM public.classification_config k
                                   WHERE k.key = 'teramind_ghost_gap_minutes'), 60)
           ) AS is_cut
    FROM (
      SELECT b.id, b.agent_id, b.employee_id, b.work_date, b.started_et, b.finished_et,
             b.started_raw, b.duration_s, b.computer, b.raw, b.synced_at, b.source, b.is_manual,
             ROW_NUMBER() OVER (PARTITION BY b.employee_id, b.work_date
                                ORDER BY b.started_et, b.finished_et, b.id) AS rn,
             MIN(b.started_et) OVER (PARTITION BY b.employee_id, b.work_date) AS day_start,
             LEAD(b.started_et) OVER (PARTITION BY b.employee_id, b.work_date
                                      ORDER BY b.started_et, b.finished_et, b.id) AS next_started_et
      FROM (
        SELECT s.id, s.agent_id, s.employee_id, s.work_date, s.started_et, s.finished_et,
               s.started_raw, s.duration_s, s.computer, s.raw, s.synced_at, s.source, s.is_manual
        FROM public.teramind_sessions s
        WHERE s.source = 'time_record'
          AND s.employee_id IS NOT NULL
      ) b
    ) w
  ) c
) g;

-- ROLLBACK
-- DROP VIEW IF EXISTS public.v_teramind_records;
-- DELETE FROM classification_config WHERE key IN
--   ('teramind_ghost_max_minutes', 'teramind_ghost_gap_minutes');
```

### `src/actions/loadTeramindDayPunches.ts`

```ts
import { action } from '@uibakery/data';

// One row per employee for ONE day from the saved Teramind copy (Time Records only): first record
// start, last record finish, how many records, seconds of tracked time, and when that employee's
// rows were last refreshed. Times are whole minutes since midnight, US Eastern, as integers —
// date-looking text is rewritten on its way to the browser. Scoped to the signed-in viewer.
// Reads public.v_teramind_records and counts only NOT is_ghost rows, so a stray early record (a
// few minutes of activity followed by an hour or more of nothing) never becomes the entry time.
// ghost_min is the earliest ignored record of that day as minutes since midnight, -1 when none.
// `manager` is accepted (house rule: every load* takes one); manager filtering happens in React.
function loadTeramindDayPunches() {
  return action('loadTeramindDayPunches', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT d.employee_id,
             SUBSTR(d.first_start, 12, 2)::int * 60 + SUBSTR(d.first_start, 15, 2)::int AS first_min,
             REPLACE(LEFT(d.last_finish, 10), '-', '')::int                              AS last_ymd,
             SUBSTR(d.last_finish, 12, 2)::int * 60 + SUBSTR(d.last_finish, 15, 2)::int  AS last_min,
             d.records,
             d.active_s,
             d.has_manual,
             COALESCE(SUBSTR(d.ghost_start, 12, 2)::int * 60 + SUBSTR(d.ghost_start, 15, 2)::int, -1) AS ghost_min,
             d.synced_at
      FROM (
        SELECT v.employee_id,
               MIN(v.started_et)  FILTER (WHERE NOT v.is_ghost)   AS first_start,
               MAX(v.finished_et) FILTER (WHERE NOT v.is_ghost)   AS last_finish,
               MIN(v.started_et)  FILTER (WHERE v.is_ghost)       AS ghost_start,
               (COUNT(*)          FILTER (WHERE NOT v.is_ghost))::int AS records,
               (SUM(v.duration_s) FILTER (WHERE NOT v.is_ghost))::int AS active_s,
               BOOL_OR(v.is_manual) FILTER (WHERE NOT v.is_ghost) AS has_manual,
               MAX(v.synced_at)                                   AS synced_at
        FROM public.v_teramind_records v
        JOIN public.employees e ON e.id = v.employee_id
        WHERE v.source = 'time_record'
          AND v.work_date = {{params.day}}::text
          AND e.active = TRUE
          AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                       WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
        GROUP BY v.employee_id
      ) d
      ORDER BY d.employee_id;
    `,
  });
}

export default loadTeramindDayPunches;
```

### `src/actions/loadTeramindActivityDays.ts`

```ts
import { action } from '@uibakery/data';

// One row per employee per calendar day from the saved Teramind copy (Time Records only): first
// record start, last record finish, seconds of tracked time, record count, the largest gap between
// consecutive records that day (and where it starts), whether any record was hand-typed, how many
// distinct Teramind accounts contributed, and when the day's rows were last refreshed. Times are
// whole minutes since midnight, US Eastern, as integers — date-looking text is rewritten on its way
// to the browser. Only employees payroll actually processes (active, not excluded) are returned,
// scoped to the signed-in viewer. Read-only.
// Reads public.v_teramind_records: every figure above — entry, exit, active time, record count and
// the gap maths — counts only NOT is_ghost rows, so a stray early record (a few minutes of activity
// followed by an hour or more of nothing) never becomes the entry time. ghost_min is the earliest
// ignored record of that day as minutes since midnight, -1 when none.
// `manager` is accepted (house rule: every load* takes one); manager filtering happens in React.
function loadTeramindActivityDays() {
  return action('loadTeramindActivityDays', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      WITH filtered AS (
        SELECT v.employee_id, v.work_date, v.started_et, v.finished_et, v.duration_s,
               v.agent_id, v.is_manual, v.is_ghost, v.synced_at
        FROM public.v_teramind_records v
        JOIN public.employees e ON e.id = v.employee_id
        WHERE v.source = 'time_record'
          AND v.work_date BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
          AND e.active = TRUE
          AND e.excluded_from_payroll = FALSE
          AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                       WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ),
      gapped AS (
        SELECT employee_id, work_date, started_et,
               LAG(finished_et) OVER (PARTITION BY employee_id, work_date ORDER BY started_et) AS prev_finished_et
        FROM filtered
        WHERE NOT is_ghost
      ),
      gaps AS (
        SELECT employee_id, work_date,
               GREATEST(0, ROUND(EXTRACT(EPOCH FROM (started_et::timestamp - prev_finished_et::timestamp)) / 60))::int AS gap_min,
               (EXTRACT(HOUR FROM prev_finished_et::timestamp) * 60 + EXTRACT(MINUTE FROM prev_finished_et::timestamp))::int AS gap_start_min
        FROM gapped
        WHERE prev_finished_et IS NOT NULL
      ),
      gap_pick AS (
        SELECT DISTINCT ON (employee_id, work_date)
               employee_id, work_date, gap_min AS largest_gap_min, gap_start_min
        FROM gaps
        ORDER BY employee_id, work_date, gap_min DESC
      ),
      daily AS (
        SELECT f.employee_id,
               f.work_date,
               MIN(f.started_et)  FILTER (WHERE NOT f.is_ghost)        AS first_start,
               MAX(f.finished_et) FILTER (WHERE NOT f.is_ghost)        AS last_finish,
               MIN(f.started_et)  FILTER (WHERE f.is_ghost)            AS ghost_start,
               (SUM(f.duration_s) FILTER (WHERE NOT f.is_ghost))::int  AS active_s,
               (COUNT(*)          FILTER (WHERE NOT f.is_ghost))::int  AS records,
               BOOL_OR(f.is_manual) FILTER (WHERE NOT f.is_ghost)      AS has_manual,
               (COUNT(DISTINCT f.agent_id) FILTER (WHERE NOT f.is_ghost))::int AS accounts,
               MAX(f.synced_at)                                        AS synced_at
        FROM filtered f
        GROUP BY f.employee_id, f.work_date
      )
      SELECT d.employee_id,
             REPLACE(d.work_date, '-', '')::int AS work_date,
             SUBSTR(d.first_start, 12, 2)::int * 60 + SUBSTR(d.first_start, 15, 2)::int AS first_min,
             REPLACE(LEFT(d.last_finish, 10), '-', '')::int AS last_ymd,
             SUBSTR(d.last_finish, 12, 2)::int * 60 + SUBSTR(d.last_finish, 15, 2)::int AS last_min,
             d.active_s,
             d.records,
             COALESCE(gp.largest_gap_min, 0) AS largest_gap_min,
             COALESCE(gp.gap_start_min, 0) AS gap_start_min,
             d.has_manual,
             d.accounts,
             COALESCE(SUBSTR(d.ghost_start, 12, 2)::int * 60 + SUBSTR(d.ghost_start, 15, 2)::int, -1) AS ghost_min,
             d.synced_at
      FROM daily d
      LEFT JOIN gap_pick gp ON gp.employee_id = d.employee_id AND gp.work_date = d.work_date
      ORDER BY d.employee_id, d.work_date;
    `,
  });
}

export default loadTeramindActivityDays;
```

### `src/actions/loadTeramindPunchDays.ts`

```ts
import { action } from '@uibakery/data';

// What payroll needs from the saved Teramind copy: one row per employee per day with the earliest
// record start and the latest record finish (Time Records only). Everything is returned as plain
// integers — YYYYMMDD and minutes since midnight, US Eastern — because date-looking text is
// rewritten on its way to the browser. Only employees payroll actually processes (active, not
// excluded) are returned, scoped to the signed-in viewer. Read-only.
// Reads public.v_teramind_records and counts only NOT is_ghost rows, so a stray early record (a few
// minutes of activity followed by an hour or more of nothing) never becomes the punch payroll sees.
// ghost_min is the earliest ignored record of that day as minutes since midnight, -1 when none, and
// display_name lets the capture card name the people whose day was corrected.
// `manager` is accepted (house rule: every load* takes one); it is not used.
function loadTeramindPunchDays() {
  return action('loadTeramindPunchDays', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT d.employee_id,
             d.teramind_email,
             d.display_name,
             REPLACE(d.work_date, '-', '')::int                 AS day_ymd,
             REPLACE(LEFT(d.first_start, 10), '-', '')::int     AS first_ymd,
             SUBSTR(d.first_start, 12, 2)::int * 60 + SUBSTR(d.first_start, 15, 2)::int AS first_min,
             REPLACE(LEFT(d.last_finish, 10), '-', '')::int     AS last_ymd,
             SUBSTR(d.last_finish, 12, 2)::int * 60 + SUBSTR(d.last_finish, 15, 2)::int AS last_min,
             d.records,
             d.has_manual,
             COALESCE(SUBSTR(d.ghost_start, 12, 2)::int * 60 + SUBSTR(d.ghost_start, 15, 2)::int, -1) AS ghost_min
      FROM (
        SELECT e.id                       AS employee_id,
               LOWER(e.teramind_email)    AS teramind_email,
               e.display_name             AS display_name,
               v.work_date,
               MIN(v.started_et)  FILTER (WHERE NOT v.is_ghost)   AS first_start,
               MAX(v.finished_et) FILTER (WHERE NOT v.is_ghost)   AS last_finish,
               MIN(v.started_et)  FILTER (WHERE v.is_ghost)       AS ghost_start,
               (COUNT(*)          FILTER (WHERE NOT v.is_ghost))::int AS records,
               BOOL_OR(v.is_manual) FILTER (WHERE NOT v.is_ghost) AS has_manual
        FROM public.v_teramind_records v
        JOIN public.employees e ON e.id = v.employee_id
        WHERE v.source = 'time_record'
          AND v.work_date BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
          AND e.active = TRUE
          AND e.excluded_from_payroll = FALSE
          AND COALESCE(e.teramind_email, '') <> ''
          AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                       WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
        GROUP BY e.id, e.teramind_email, e.display_name, v.work_date
      ) d
      ORDER BY d.employee_id, d.work_date;
    `,
  });
}

export default loadTeramindPunchDays;
```

### `src/actions/loadTeramindVsPayroll.ts`

```ts
import { action } from '@uibakery/data';

// One row per employee per day: Teramind's earliest session start / latest finish beside what
// payroll holds for that day. Read-only. Times are returned as whole minutes since midnight
// (integers) because date-looking text is rewritten on its way to the browser.
// Reads public.v_teramind_records with NOT is_ghost, so the Teramind side of the comparison shows
// the same entry as the Activity tab and the payroll capture: a stray early record (a few minutes
// of activity followed by an hour or more of nothing) is left out of every figure. The view only
// holds Time Records, so {{params.source}} can only ever match 'time_record' here.
// `manager` is accepted (house rule: every load* takes one); filtering by manager happens in React.
function loadTeramindVsPayroll() {
  return action('loadTeramindVsPayroll', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      WITH tm AS (
        SELECT v.employee_id,
               v.work_date,
               MIN(v.started_et)  AS first_start,
               MAX(v.finished_et) AS last_finish,
               COUNT(*)::int      AS sessions,
               MAX(v.duration_s)::int AS longest_s,
               BOOL_OR(v.is_manual)   AS has_manual
        FROM public.v_teramind_records v
        WHERE NOT v.is_ghost
          AND v.source = {{params.source}}::text
          AND v.work_date BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
        GROUP BY v.employee_id, v.work_date
      ),
      pe AS (
        SELECT DISTINCT ON (p.employee_id, LEFT(p.work_date, 10))
               p.employee_id,
               LEFT(p.work_date, 10) AS work_date,
               p.period_name,
               NULLIF(TRIM(p.entry_time), '') AS entry_time,
               NULLIF(TRIM(p.exit_time), '')  AS exit_time,
               p.event_type_1,
               p.initial_status,
               (p.updated_at > p.created_at + interval '2 minutes') AS touched_after_run
        FROM public.payroll_entries p
        WHERE p.deleted_at IS NULL
          AND LEFT(p.work_date, 10) BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
        ORDER BY p.employee_id, LEFT(p.work_date, 10), p.period_name DESC
      )
      SELECT e.id AS employee_id,
             e.display_name AS name,
             j.work_date AS day,
             j.period_name,
             j.entry_time AS pay_entry,
             j.exit_time  AS pay_exit,
             CASE WHEN UPPER(j.entry_time) ~ '^[0-9]{1,2}:[0-9]{2} ?[AP]M$'
                  THEN (EXTRACT(EPOCH FROM to_timestamp(UPPER(j.entry_time), 'HH12:MI AM')::time) / 60)::int END AS pay_entry_min,
             CASE WHEN UPPER(j.exit_time) ~ '^[0-9]{1,2}:[0-9]{2} ?[AP]M$'
                  THEN (EXTRACT(EPOCH FROM to_timestamp(UPPER(j.exit_time), 'HH12:MI AM')::time) / 60)::int END AS pay_exit_min,
             CASE WHEN j.first_start IS NOT NULL
                  THEN SUBSTR(j.first_start, 12, 2)::int * 60 + SUBSTR(j.first_start, 15, 2)::int END AS tm_entry_min,
             CASE WHEN j.last_finish IS NOT NULL
                  THEN SUBSTR(j.last_finish, 12, 2)::int * 60 + SUBSTR(j.last_finish, 15, 2)::int END AS tm_exit_min,
             (LEFT(j.last_finish, 10) > j.work_date) AS tm_exit_next_day,
             j.sessions,
             j.longest_s,
             j.has_manual,
             j.event_type_1,
             j.initial_status,
             j.touched_after_run
      FROM (
        SELECT COALESCE(tm.employee_id, pe.employee_id) AS employee_id,
               COALESCE(tm.work_date, pe.work_date)     AS work_date,
               tm.first_start, tm.last_finish, tm.sessions, tm.longest_s, tm.has_manual,
               pe.period_name, pe.entry_time, pe.exit_time, pe.event_type_1, pe.initial_status,
               pe.touched_after_run
        FROM tm
        FULL OUTER JOIN pe ON pe.employee_id = tm.employee_id AND pe.work_date = tm.work_date
      ) j
      JOIN public.employees e ON e.id = j.employee_id
      WHERE e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                     WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ORDER BY j.work_date, e.display_name;
    `,
  });
}

export default loadTeramindVsPayroll;
```

## Acceptance

- The migration applies cleanly, and applies a second time without error. Afterwards
  `SELECT key, value FROM classification_config WHERE category = 'teramind' AND key LIKE
  'teramind_ghost_%'` returns `teramind_ghost_max_minutes = 5` and `teramind_ghost_gap_minutes = 60`,
  and `SELECT COUNT(*) FROM public.v_teramind_records WHERE is_ghost` runs.
- On the Activity tab, for **2026-09-18**, **Nichole Harris**'s Entry reads **9:21 AM** (it read
  **6:24 AM** before this change). Her record count and active time drop by that one stray record;
  her Exit is unchanged.
- Nobody else's Entry moves except the people whose first record is a stray one — on 2026-09-18 that
  is Charis Dixon, Monique Luque and Yessenia Moran.
- Each of the four action files is **under 15 KB**.
- `node --test "tests/*.test.ts"` still passes.
