-- RECOVERED FROM THE DATABASE — ALREADY APPLIED. DO NOT RE-RUN.
--
-- migration_id: 1781280400_fix_view_use_db_late_minutes
-- name:         fix view use db late minutes
-- applied_at:   2026-06-15 18:45:36
-- applied_by:   system
-- checksum:     6e41e9afdaaaa6357168a62abf799bc9cdcc314789091f2b755121ac1f2e3a71
--
-- This migration ran against GAF Planilla DB but has no file in the UI
-- Bakery project. Recovered 2026-08-11 from the uib_migrations table so the
-- schema's history is not lost. It is a record, not a migration to execute.

-- Migration 1781280400
-- 1. Fix schedules: standard_start was '9:00 AM' but employees are measured against 8:00 AM.
--    The classification engine already stores the correct late_minutes (relative to 8:00 AM shift).
-- 2. Rebuild v_attendance_daily to use pe.late_minutes directly from DB instead of recomputing
--    from entry_t - shift_t (which was wrong because shift was incorrectly stored as 9:00 AM).
-- 3. For Late-Unreported detection: use entry_t > 08:00:00 AND no Tardanza AND late_minutes = 0
--    (classification engine would have set late_minutes for reported cases only).

UPDATE public.schedules
SET standard_start = '8:00 AM'
WHERE standard_start = '9:00 AM';

CREATE OR REPLACE VIEW public.v_attendance_daily AS
WITH base AS (
  SELECT
    pe.employee_id,
    e.display_name                                           AS name,
    e.teramind_email                                         AS email,
    LEFT(pe.work_date, 10)::date                             AS work_date,
    NULLIF(TRIM(pe.entry_time), '')                          AS entry_time_txt,
    COALESCE(NULLIF(TRIM(pe.event_type_1), ''), '')          AS event_type_1,
    pe.late_minutes                                          AS db_late_minutes,
    pe.period_name
  FROM payroll_entries pe
  JOIN employees e ON e.id = pe.employee_id
  WHERE e.active = true
    AND COALESCE(e.excluded_from_payroll, false) = false
),
parsed AS (
  SELECT
    b.*,
    -- Parse entry_time for unreported-late detection
    CASE
      WHEN b.entry_time_txt IS NULL                      THEN NULL::time
      WHEN b.entry_time_txt ~* '[AP]M$'
        THEN to_timestamp(b.entry_time_txt, 'HH:MI AM')::time
      WHEN b.entry_time_txt ~ '^\d{1,2}:\d{2}:\d{2}$'
        THEN to_timestamp(b.entry_time_txt, 'HH24:MI:SS')::time
      ELSE NULL::time
    END AS entry_t,
    -- Shift is 8:00 AM (confirmed from late_minutes values in DB)
    '08:00:00'::time AS shift_t,
    -- Classify event types
    b.event_type_1 = ANY(ARRAY[
      'Feriado','PTO','Ausencia Justificada.','Ausencia Injustificada'
    ]) AS is_dropped,
    b.event_type_1 = ANY(ARRAY[
      'Permiso Remunerado','Permiso No remunerado','Permission','Time Off'
    ]) AS is_permission,
    b.event_type_1 = ANY(ARRAY['Tardanza','Tardiness']) AS is_reported
  FROM base b
),
classified AS (
  SELECT
    p.*,
    -- Use db_late_minutes (set by classification engine) as the authoritative value.
    -- For unreported rows: compute from entry_t - 8:00 AM if entry_t > 8:00 AM, else 0.
    CASE
      WHEN p.is_reported THEN COALESCE(p.db_late_minutes, 0)
      WHEN p.entry_t IS NOT NULL AND p.entry_t > p.shift_t
        THEN GREATEST(0, floor(EXTRACT(epoch FROM p.entry_t - p.shift_t) / 60.0))::integer
      ELSE 0
    END AS minutes_late
  FROM parsed p
  WHERE p.is_dropped = false
    AND (p.entry_t IS NOT NULL OR p.is_permission OR p.is_reported)
)
SELECT DISTINCT ON (employee_id, work_date)
  email,
  name,
  work_date                                                AS date,
  to_char(entry_t, 'HH24:MI')                             AS entry_time,
  CASE
    WHEN is_permission                        THEN 'Permission'
    WHEN is_reported                          THEN 'Late - Reported'
    WHEN minutes_late > 0                     THEN 'Late - Unreported'
    ELSE                                           'On Time'
  END                                                      AS status,
  CASE
    WHEN is_permission                        THEN NULL
    WHEN minutes_late BETWEEN 1  AND 10       THEN 'late_1to10'
    WHEN minutes_late BETWEEN 11 AND 30       THEN 'late_11to30'
    WHEN minutes_late > 30                    THEN 'late_830plus'
    ELSE                                           'on_time'
  END                                                      AS bucket,
  is_reported                                              AS filed_gaf,
  minutes_late,
  period_name
FROM classified
WHERE EXTRACT(isodow FROM work_date) < 6
ORDER BY employee_id, work_date, period_name DESC;