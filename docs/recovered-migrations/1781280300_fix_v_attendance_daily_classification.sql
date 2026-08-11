-- RECOVERED FROM THE DATABASE — ALREADY APPLIED. DO NOT RE-RUN.
--
-- migration_id: 1781280300_fix_v_attendance_daily_classification
-- name:         fix v attendance daily classification
-- applied_at:   2026-06-15 16:51:32
-- applied_by:   system
-- checksum:     35dd233be4cfb739dc4b9c6bd5b0098bc435e6fb1cbd973e144c09d2189c8b02
--
-- This migration ran against GAF Planilla DB but has no file in the UI
-- Bakery project. Recovered 2026-08-11 from the uib_migrations table so the
-- schema's history is not lost. It is a record, not a migration to execute.

-- Fix v_attendance_daily classification to match v9_6 baseline:
-- 1. Feriado (company holiday) rows are EXCLUDED from the view entirely — no per-employee row on a company holiday.
-- 2. PTO, Ausencia Justificada., Ausencia Injustificada are also EXCLUDED (dropped from view, not counted as Excused).
--    These are genuine absences; they do not count against on-time rate (not tracked that day).
-- 3. Permiso rows (Permiso Remunerado, Permiso No remunerado, Permission, Time Off) are kept as 'Permission' status
--    and excluded from on-time denominator.
-- 4. Salida Temprano has a real entry_time — treated as a normal tracked day (on-time or late by clock-in).
-- 5. Late-Unreported: blank event_type with entry_t > shift_t → Late - Unreported (no change needed, already works).
-- 6. Rows with no entry_time AND no recognized event_type (true absences with no filing) are EXCLUDED.

CREATE OR REPLACE VIEW public.v_attendance_daily AS
WITH base AS (
  SELECT
    pe.employee_id,
    e.display_name                                          AS name,
    e.teramind_email                                        AS email,
    LEFT(pe.work_date, 10)::date                            AS work_date,
    NULLIF(TRIM(pe.entry_time), '')                         AS entry_time_txt,
    COALESCE(NULLIF(TRIM(pe.event_type_1), ''), '')         AS event_type_1,
    COALESCE(NULLIF(TRIM(s.standard_start), ''), '9:00 AM') AS shift_start_txt,
    pe.period_name
  FROM payroll_entries pe
  JOIN employees e ON e.id = pe.employee_id
  LEFT JOIN schedules s ON s.id = e.schedule_id
  WHERE e.active = true
    AND COALESCE(e.excluded_from_payroll, false) = false
),
parsed AS (
  SELECT
    b.employee_id, b.name, b.email, b.work_date,
    b.entry_time_txt, b.event_type_1, b.shift_start_txt, b.period_name,
    CASE
      WHEN b.entry_time_txt IS NULL                       THEN NULL::time
      WHEN b.entry_time_txt ~* '[AP]M$'
        THEN to_timestamp(b.entry_time_txt, 'HH:MI AM')::time
      WHEN b.entry_time_txt ~ '^\d{1,2}:\d{2}:\d{2}$'
        THEN to_timestamp(b.entry_time_txt, 'HH24:MI:SS')::time
      ELSE NULL::time
    END AS entry_t,
    to_timestamp(b.shift_start_txt, 'HH:MI AM')::time AS shift_t,
    -- Rows to DROP entirely from the view (not tracked):
    -- Feriado = company holiday (whole day off for everyone)
    -- PTO / Ausencia Justificada. / Ausencia Injustificada = full-day absences (not tracked)
    b.event_type_1 = ANY(ARRAY[
      'Feriado',
      'PTO',
      'Ausencia Justificada.',
      'Ausencia Injustificada'
    ])                                                     AS is_dropped,
    -- Permission = partial-day leave: keep row, exclude from on-time denominator
    b.event_type_1 = ANY(ARRAY[
      'Permiso Remunerado', 'Permiso No remunerado', 'Permission', 'Time Off'
    ])                                                     AS is_permission,
    -- Reported = Tardanza/Tardiness filed
    b.event_type_1 = ANY(ARRAY[
      'Tardanza', 'Tardiness'
    ])                                                     AS is_reported
  FROM base b
),
classified AS (
  SELECT
    p.employee_id, p.name, p.email, p.work_date,
    p.entry_time_txt, p.event_type_1, p.shift_start_txt, p.period_name,
    p.entry_t, p.shift_t, p.is_dropped, p.is_permission, p.is_reported,
    CASE
      WHEN p.entry_t IS NULL THEN NULL::integer
      ELSE GREATEST(0, floor(EXTRACT(epoch FROM p.entry_t - p.shift_t) / 60.0))::integer
    END AS minutes_late
  FROM parsed p
  -- Drop: company holidays, full-day absences (PTO, Ausencia Justificada/Injustificada)
  -- Keep: permission rows (no entry_t OK), reported rows (may have entry_t), clock-in rows
  WHERE p.is_dropped = false
    AND (p.entry_t IS NOT NULL OR p.is_permission OR p.is_reported)
)
SELECT DISTINCT ON (employee_id, work_date)
  email,
  name,
  work_date                                                AS date,
  to_char(entry_t, 'HH24:MI')                             AS entry_time,
  CASE
    WHEN is_permission                 THEN 'Permission'
    WHEN is_reported                   THEN 'Late - Reported'
    WHEN minutes_late = 0              THEN 'On Time'
    ELSE                                    'Late - Unreported'
  END                                                      AS status,
  CASE
    WHEN is_permission                    THEN NULL
    WHEN is_reported OR minutes_late > 0  THEN
      CASE
        WHEN COALESCE(minutes_late, 0) BETWEEN 1  AND 10 THEN 'late_1to10'
        WHEN COALESCE(minutes_late, 0) BETWEEN 11 AND 30 THEN 'late_11to30'
        WHEN COALESCE(minutes_late, 0) > 30              THEN 'late_830plus'
        ELSE 'late_1to10'
      END
    ELSE 'on_time'
  END                                                      AS bucket,
  is_reported                                              AS filed_gaf,
  COALESCE(minutes_late, 0)                                AS minutes_late,
  period_name
FROM classified
WHERE EXTRACT(isodow FROM work_date) < 6
ORDER BY employee_id, work_date, period_name DESC;