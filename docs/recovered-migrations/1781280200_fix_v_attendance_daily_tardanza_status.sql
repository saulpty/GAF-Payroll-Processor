-- RECOVERED FROM THE DATABASE — ALREADY APPLIED. DO NOT RE-RUN.
--
-- migration_id: 1781280200_fix_v_attendance_daily_tardanza_status
-- name:         fix v attendance daily tardanza status
-- applied_at:   2026-06-15 16:07:35
-- applied_by:   system
-- checksum:     1501fcb2addd6a426b4d728f0b30377b36ec41b96d64e4f9e658f8a83abc163b
--
-- This migration ran against GAF Planilla DB but has no file in the UI
-- Bakery project. Recovered 2026-08-11 from the uib_migrations table so the
-- schema's history is not lost. It is a record, not a migration to execute.

-- Fix v_attendance_daily: Tardanza rows must be classified as Late - Reported
-- even when minutes_late = 0 (entry time at or before shift start due to rounding).
-- Previously WHEN minutes_late = 0 THEN 'On Time' was evaluated before WHEN is_reported,
-- causing 554 Tardanza rows to be misclassified as On Time.

CREATE OR REPLACE VIEW public.v_attendance_daily AS
WITH base AS (
  SELECT
    pe.employee_id,
    e.display_name AS name,
    e.teramind_email AS email,
    LEFT(pe.work_date, 10)::date AS work_date,
    NULLIF(TRIM(pe.entry_time), '') AS entry_time_txt,
    COALESCE(NULLIF(TRIM(pe.event_type_1), ''), '') AS event_type_1,
    COALESCE(NULLIF(TRIM(s.standard_start), ''), '9:00 AM') AS shift_start_txt,
    pe.period_name
  FROM payroll_entries pe
  JOIN employees e ON e.id = pe.employee_id
  LEFT JOIN schedules s ON s.id = e.schedule_id
  WHERE e.active = true AND COALESCE(e.excluded_from_payroll, false) = false
),
parsed AS (
  SELECT
    b.employee_id, b.name, b.email, b.work_date,
    b.entry_time_txt, b.event_type_1, b.shift_start_txt, b.period_name,
    CASE
      WHEN b.entry_time_txt IS NULL THEN NULL::time
      WHEN b.entry_time_txt ~* '[AP]M$' THEN to_timestamp(b.entry_time_txt, 'HH:MI AM')::time
      WHEN b.entry_time_txt ~ '^\d{1,2}:\d{2}:\d{2}$' THEN to_timestamp(b.entry_time_txt, 'HH24:MI:SS')::time
      ELSE NULL::time
    END AS entry_t,
    to_timestamp(b.shift_start_txt, 'HH:MI AM')::time AS shift_t,
    b.event_type_1 = ANY(ARRAY['PTO','Feriado','Compensatory Day','Birthday Day Off','Ausencia Justificada.','Ausencia Injustificada']) AS is_excused,
    b.event_type_1 = ANY(ARRAY['Permiso Remunerado','Permiso No remunerado','Permission','Time Off']) AS is_permission,
    b.event_type_1 = ANY(ARRAY['Tardanza','Tardiness']) AS is_reported
  FROM base b
),
classified AS (
  SELECT
    p.employee_id, p.name, p.email, p.work_date,
    p.entry_time_txt, p.event_type_1, p.shift_start_txt, p.period_name,
    p.entry_t, p.shift_t, p.is_excused, p.is_permission, p.is_reported,
    CASE
      WHEN p.entry_t IS NULL THEN NULL::integer
      ELSE GREATEST(0, floor(EXTRACT(epoch FROM p.entry_t - p.shift_t) / 60.0))::integer
    END AS minutes_late
  FROM parsed p
)
SELECT DISTINCT ON (employee_id, work_date)
  email,
  name,
  work_date AS date,
  to_char(entry_t::interval, 'HH24:MI') AS entry_time,
  CASE
    WHEN is_excused    THEN 'Excused (PTO/FH/Perm)'
    WHEN is_permission THEN 'Permission'
    WHEN is_reported   THEN 'Late - Reported'
    WHEN minutes_late = 0 THEN 'On Time'
    ELSE 'Late - Unreported'
  END AS status,
  CASE
    WHEN is_excused OR is_permission THEN NULL
    WHEN is_reported OR minutes_late > 0 THEN
      CASE
        WHEN COALESCE(minutes_late, 0) >= 1  AND COALESCE(minutes_late, 0) <= 10 THEN 'late_1to10'
        WHEN COALESCE(minutes_late, 0) >= 11 AND COALESCE(minutes_late, 0) <= 30 THEN 'late_11to30'
        WHEN COALESCE(minutes_late, 0) > 30  THEN 'late_830plus'
        ELSE 'late_1to10'
      END
    ELSE 'on_time'
  END AS bucket,
  is_reported AS filed_gaf,
  COALESCE(minutes_late, 0) AS minutes_late,
  period_name
FROM classified
WHERE EXTRACT(isodow FROM work_date) < 6
  AND (entry_t IS NOT NULL OR is_excused OR is_permission)
ORDER BY employee_id, work_date, period_name DESC;