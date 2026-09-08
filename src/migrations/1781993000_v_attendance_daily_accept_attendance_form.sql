-- Redefine v_attendance_daily so gaf_filed recognises BOTH documentation
-- strings for a filed attendance form.
--
-- classificationEngine.ts wrote 'Form Submitted' until 2026-08-27 and writes
-- 'Attendance Form' after it (line 742, the late-with-tardiness-form branch).
-- The view only knew the old string, so the first payroll run after the rename
-- would have shown every filed form as "Late - Unreported" with no error.
--
-- Deliberately NOT accepted here: 'Time Adjustment Form', 'Permission Form',
-- 'Doctor Note - Pending', 'Doctor Note - Logged'. Those describe different
-- situations and the view has never counted them; widening the KPI is a
-- separate decision, not part of this fix.
--
-- Changes from 1781900300: the gaf_filed line only.
-- Rollback: re-run 1781900300_v_attendance_daily_excludes_deleted.sql.

CREATE OR REPLACE VIEW public.v_attendance_daily AS
WITH base AS (
  SELECT
    pe.employee_id,
    e.display_name AS name,
    e.teramind_email AS email,
    LEFT(pe.work_date, 10)::date AS work_date,
    NULLIF(TRIM(pe.entry_time), '') AS entry_time_txt,
    COALESCE(NULLIF(TRIM(pe.event_type_1), ''), '') AS event_type_1,
    GREATEST(0, COALESCE(pe.late_minutes, 0)) AS late_minutes,
    TRIM(COALESCE(pe.documentation, '')) IN ('Form Submitted', 'Attendance Form') AS gaf_filed,
    pe.period_name,
    COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri') AS work_days
  FROM payroll_entries pe
  JOIN employees e ON e.id = pe.employee_id
  LEFT JOIN schedules s ON s.id = e.schedule_id
  WHERE e.active = true
    AND COALESCE(e.excluded_from_payroll, false) = false
    AND pe.deleted_at IS NULL
),
normalized AS (
  SELECT
    b.*,
    CASE
      WHEN b.entry_time_txt IS NULL THEN NULL
      WHEN UPPER(b.entry_time_txt) ~ '^[0-9]{1,2}[AP]M$'
        THEN REGEXP_REPLACE(UPPER(b.entry_time_txt), '^([0-9]{1,2})([AP]M)$', '\1:00 \2')
      ELSE UPPER(b.entry_time_txt)
    END AS entry_time_norm
  FROM base b
),
parsed AS (
  SELECT
    n.*,
    CASE
      WHEN n.entry_time_norm IS NULL THEN NULL::time
      ELSE to_timestamp(n.entry_time_norm, 'HH12:MI AM')::time
    END AS entry_t,
    n.event_type_1 = ANY(ARRAY[
      'PTO','Feriado','Compensatory Day','Birthday Day Off',
      'Ausencia Justificada.','Ausencia Injustificada'
    ]) AS is_excused,
    n.event_type_1 = ANY(ARRAY[
      'Permiso Remunerado','Permiso No remunerado','Permission','Time Off'
    ]) AS is_permission
  FROM normalized n
)
SELECT DISTINCT ON (employee_id, work_date)
  email,
  name,
  work_date AS date,
  -- No DST offset: stored times are already US Eastern wall-clock
  TO_CHAR(entry_t, 'HH24:MI') AS entry_time,
  CASE
    WHEN is_excused  THEN 'Excused (PTO/FH/Perm)'
    WHEN is_permission THEN 'Permission'
    WHEN late_minutes = 0 THEN 'On Time'
    WHEN gaf_filed THEN 'Late - Reported'
    ELSE 'Late - Unreported'
  END AS status,
  CASE
    WHEN is_excused OR is_permission THEN NULL
    WHEN late_minutes = 0             THEN 'on_time'
    WHEN late_minutes BETWEEN 1 AND 10  THEN 'late_1to10'
    WHEN late_minutes BETWEEN 11 AND 30 THEN 'late_11to30'
    ELSE 'late_830plus'
  END AS bucket,
  gaf_filed AS filed_gaf,
  late_minutes AS minutes_late,
  period_name
FROM parsed
WHERE (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])[EXTRACT(ISODOW FROM work_date)::int]
      = ANY (string_to_array(work_days, ','))
  AND (entry_t IS NOT NULL OR is_excused OR is_permission)
ORDER BY employee_id, work_date, period_name DESC;
