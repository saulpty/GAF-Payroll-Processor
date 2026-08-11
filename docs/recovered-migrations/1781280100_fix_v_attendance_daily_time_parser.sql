-- RECOVERED FROM THE DATABASE — ALREADY APPLIED. DO NOT RE-RUN.
--
-- migration_id: 1781280100_fix_v_attendance_daily_time_parser
-- name:         fix v attendance daily time parser
-- applied_at:   2026-06-15 15:12:23
-- applied_by:   system
-- checksum:     d45fed160f2c66c0885cf8deac4a0f96d2f3fb107f117503141fbd986a596d0c
--
-- This migration ran against GAF Planilla DB but has no file in the UI
-- Bakery project. Recovered 2026-08-11 from the uib_migrations table so the
-- schema's history is not lost. It is a record, not a migration to execute.

-- Fix v_attendance_daily: handle "12:xx AM/PM" (12-hour boundary) and
-- "HH:MM:SS" (24-hour with seconds, no meridiem) formats in entry_time.
-- Use HH:MI AM format mask (not HH12) which Postgres handles correctly for all 12-h values.

CREATE OR REPLACE VIEW public.v_attendance_daily AS
WITH
base AS (
  SELECT
    pe.employee_id,
    e.display_name                                          AS name,
    e.teramind_email                                        AS email,
    LEFT(pe.work_date, 10)::date                            AS work_date,
    NULLIF(TRIM(pe.entry_time), '')                         AS entry_time_txt,
    COALESCE(NULLIF(TRIM(pe.event_type_1), ''), '')         AS event_type_1,
    COALESCE(NULLIF(TRIM(s.standard_start), ''), '9:00 AM') AS shift_start_txt,
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
    -- "H:MM AM" / "H:MM PM" / "12:MM AM" / "12:MM PM"  → use HH:MI AM (not HH12)
    -- "HH:MM:SS" 24-h with seconds, no meridiem         → use HH24:MI:SS
    CASE
      WHEN entry_time_txt IS NULL                         THEN NULL
      WHEN entry_time_txt ~* '[AP]M$'
        THEN to_timestamp(entry_time_txt, 'HH:MI AM')::time
      WHEN entry_time_txt ~ '^\d{1,2}:\d{2}:\d{2}$'
        THEN to_timestamp(entry_time_txt, 'HH24:MI:SS')::time
      ELSE NULL
    END                                                    AS entry_t,
    to_timestamp(shift_start_txt, 'HH:MI AM')::time        AS shift_t,
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
  work_date                                                AS date,
  to_char(entry_t, 'HH24:MI')                              AS entry_time,
  CASE
    WHEN is_excused               THEN 'Excused (PTO/FH/Perm)'
    WHEN is_permission            THEN 'Permission'
    WHEN minutes_late = 0         THEN 'On Time'
    WHEN is_reported              THEN 'Late - Reported'
    ELSE                               'Late - Unreported'
  END                                                      AS status,
  CASE
    WHEN is_excused OR is_permission  THEN NULL
    WHEN minutes_late = 0             THEN 'on_time'
    WHEN minutes_late BETWEEN 1  AND 10  THEN 'late_1to10'
    WHEN minutes_late BETWEEN 11 AND 30  THEN 'late_11to30'
    ELSE                                   'late_830plus'
  END                                                      AS bucket,
  is_reported                                              AS filed_gaf,
  COALESCE(minutes_late, 0)                                AS minutes_late,
  period_name
FROM classified
WHERE EXTRACT(ISODOW FROM work_date) < 6
  AND (entry_t IS NOT NULL OR is_excused OR is_permission)
ORDER BY employee_id, work_date, period_name DESC;