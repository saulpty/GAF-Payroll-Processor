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
