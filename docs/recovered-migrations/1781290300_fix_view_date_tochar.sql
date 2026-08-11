-- RECOVERED FROM THE DATABASE — ALREADY APPLIED. DO NOT RE-RUN.
--
-- migration_id: 1781290300_fix_view_date_tochar
-- name:         fix view date tochar
-- applied_at:   2026-06-16 15:16:43
-- applied_by:   system
-- checksum:     ca2c3ca09eb9c45d998dd495d60f718c7746cd42e697243c3c9bab3e64fa5b17
--
-- This migration ran against GAF Planilla DB but has no file in the UI
-- Bakery project. Recovered 2026-08-11 from the uib_migrations table so the
-- schema's history is not lost. It is a record, not a migration to execute.

-- Fix: CAST(date AS text) still serializes as ISO timestamp via the JS driver.
-- Use TO_CHAR(work_date, 'YYYY-MM-DD') to force a plain text string.
DROP VIEW IF EXISTS public.v_attendance_daily;

CREATE VIEW public.v_attendance_daily AS
WITH
base AS (
  SELECT
    pe.employee_id,
    e.display_name                                           AS name,
    e.teramind_email                                         AS email,
    LEFT(pe.work_date, 10)::date                             AS work_date,
    NULLIF(TRIM(pe.entry_time), '')                          AS entry_time_txt,
    COALESCE(NULLIF(TRIM(pe.event_type_1), ''), '')          AS event_type_1,
    COALESCE(NULLIF(TRIM(s.standard_start), ''), '9:00 AM')  AS shift_start_txt,
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
    CASE
      WHEN entry_time_txt IS NULL                        THEN NULL
      WHEN entry_time_txt ILIKE '%AM' OR entry_time_txt ILIKE '%PM'
        THEN to_timestamp(entry_time_txt, 'HH12:MI AM')::time
      ELSE to_timestamp(entry_time_txt, 'HH24:MI:SS')::time
    END                                                    AS entry_t,
    to_timestamp(shift_start_txt, 'HH12:MI AM')::time      AS shift_t,
    event_type_1 = ANY(ARRAY[
      'PTO','Feriado','Compensatory Day','Birthday Day Off',
      'Ausencia Justificada.','Ausencia Injustificada'
    ])                                                     AS is_excused,
    event_type_1 = ANY(ARRAY[
      'Permiso Remunerado','Permiso No remunerado','Permission','Time Off'
    ])                                                     AS is_permission,
    event_type_1 = ANY(ARRAY[
      'Tardanza','Tardiness'
    ])                                                     AS is_reported
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