-- RECOVERED FROM THE DATABASE — ALREADY APPLIED. DO NOT RE-RUN.
--
-- migration_id: 1781290400_fix_view_dst_aware
-- name:         fix view dst aware
-- applied_at:   2026-06-16 15:22:08
-- applied_by:   system
-- checksum:     236beae5fb366d610108b6a89f03ee5e2a6b36affec8ca239b6502dcdef390e9
--
-- This migration ran against GAF Planilla DB but has no file in the UI
-- Bakery project. Recovered 2026-08-11 from the uib_migrations table so the
-- schema's history is not lost. It is a record, not a migration to execute.

-- Fix v_attendance_daily to be DST-aware:
-- 1. Teramind entry_time is always US Eastern. During US DST, Panama = Eastern - 1hr.
--    During Standard time, Panama = Eastern (both UTC-5).
-- 2. Compare converted Panama entry_time against the correct shift start:
--    dst_start when DST is active, standard_start otherwise.
-- 3. Use the employee's actual dst_start / standard_start from schedules.

DROP VIEW IF EXISTS public.v_attendance_daily;

CREATE VIEW public.v_attendance_daily AS
WITH
dst AS (
  -- Build a flat date-range table of DST-active dates per year
  SELECT
    generate_series(us_dst_start::date, (us_dst_end::date - INTERVAL '1 day')::date, INTERVAL '1 day')::date AS dst_date
  FROM dst_calendar
),
base AS (
  SELECT
    pe.employee_id,
    e.display_name                                           AS name,
    e.teramind_email                                         AS email,
    LEFT(pe.work_date, 10)::date                             AS work_date,
    NULLIF(TRIM(pe.entry_time), '')                          AS entry_time_txt,
    COALESCE(NULLIF(TRIM(pe.event_type_1), ''), '')          AS event_type_1,
    -- Pick correct shift start based on DST
    CASE
      WHEN EXISTS (SELECT 1 FROM dst WHERE dst.dst_date = LEFT(pe.work_date, 10)::date)
        THEN COALESCE(NULLIF(TRIM(s.dst_start),      ''), '8:00 AM')
      ELSE    COALESCE(NULLIF(TRIM(s.standard_start), ''), '9:00 AM')
    END                                                      AS shift_start_txt,
    -- Is this date in US DST?
    EXISTS (SELECT 1 FROM dst WHERE dst.dst_date = LEFT(pe.work_date, 10)::date) AS in_dst,
    pe.period_name
  FROM public.payroll_entries pe
  JOIN public.employees  e ON e.id = pe.employee_id
  LEFT JOIN public.schedules s ON s.id = e.schedule_id
  WHERE e.active = true
    AND COALESCE(e.excluded_from_payroll, false) = false
),
parsed AS (
  SELECT
    b.*,
    -- Parse entry_time (US Eastern from Teramind), then convert to Panama time
    -- During DST: Panama = US Eastern - 1 hr
    -- During Standard: Panama = US Eastern (same UTC-5)
    CASE
      WHEN entry_time_txt IS NULL THEN NULL
      WHEN entry_time_txt ILIKE '%AM' OR entry_time_txt ILIKE '%PM'
        THEN (
          to_timestamp(entry_time_txt, 'HH12:MI AM')::time
          - CASE WHEN in_dst THEN INTERVAL '1 hour' ELSE INTERVAL '0' END
        )
      ELSE (
        to_timestamp(entry_time_txt, 'HH24:MI:SS')::time
        - CASE WHEN in_dst THEN INTERVAL '1 hour' ELSE INTERVAL '0' END
      )
    END                                                      AS entry_t,
    to_timestamp(shift_start_txt, 'HH12:MI AM')::time        AS shift_t,
    event_type_1 = ANY(ARRAY[
      'PTO','Feriado','Compensatory Day','Birthday Day Off',
      'Ausencia Justificada.','Ausencia Injustificada'
    ])                                                       AS is_excused,
    event_type_1 = ANY(ARRAY[
      'Permiso Remunerado','Permiso No remunerado','Permission','Time Off'
    ])                                                       AS is_permission,
    event_type_1 = ANY(ARRAY[
      'Tardanza','Tardiness'
    ])                                                       AS is_reported
  FROM base b
),
classified AS (
  SELECT
    p.*,
    CASE WHEN entry_t IS NULL THEN NULL
         ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (entry_t - shift_t)) / 60.0))::int
    END AS minutes_late
  FROM parsed p
)
SELECT DISTINCT ON (employee_id, work_date)
  email,
  name,
  TO_CHAR(work_date, 'YYYY-MM-DD')                          AS date,
  to_char(entry_t, 'HH24:MI')                               AS entry_time,
  CASE
    WHEN is_excused               THEN 'Excused (PTO/FH/Perm)'
    WHEN is_permission            THEN 'Permission'
    WHEN minutes_late = 0         THEN 'On Time'
    WHEN is_reported              THEN 'Late - Reported'
    ELSE                               'Late - Unreported'
  END                                                       AS status,
  CASE
    WHEN is_excused OR is_permission  THEN NULL
    WHEN minutes_late = 0             THEN 'on_time'
    WHEN minutes_late BETWEEN 1  AND 10  THEN 'late_1to10'
    WHEN minutes_late BETWEEN 11 AND 30  THEN 'late_11to30'
    ELSE                                   'late_830plus'
  END                                                       AS bucket,
  is_reported                                               AS filed_gaf,
  COALESCE(minutes_late, 0)                                 AS minutes_late,
  period_name
FROM classified
WHERE EXTRACT(ISODOW FROM work_date) < 6
  AND (entry_t IS NOT NULL OR is_excused OR is_permission)
ORDER BY employee_id, work_date, period_name DESC;