-- Split 'Ausencia Injustificada' out of the Excused bucket into its own
-- 'Absent - Unexplained' status.
--
-- Background: 'Ausencia Injustificada' rows represent no-shows that were not
-- covered by PTO, a holiday, or an approved permission.  Lumping them into
-- 'Excused (PTO/FH/Perm)' caused them to be excluded from on-time rate
-- calculations, inflating the KPI.  They now appear as a distinct status so
-- the dashboard can show them separately.
--
-- Changes from 1781993000:
--   • 'Ausencia Injustificada' removed from the is_excused array
--   • New is_absent flag added
--   • status CASE: 'Absent - Unexplained' inserted before 'Permission'
--   • bucket CASE: 'absent' inserted before the late_minutes = 0 branch
--   • WHERE clause: OR is_absent added so absent rows are included
-- Rollback: re-run 1781993000_v_attendance_daily_accept_attendance_form.sql.

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
    -- 'Ausencia Injustificada' is intentionally excluded from is_excused
    n.event_type_1 = ANY(ARRAY[
      'PTO','Feriado','Compensatory Day','Birthday Day Off',
      'Ausencia Justificada.'
    ]) AS is_excused,
    n.event_type_1 = ANY(ARRAY[
      'Permiso Remunerado','Permiso No remunerado','Permission','Time Off'
    ]) AS is_permission,
    n.event_type_1 = 'Ausencia Injustificada' AS is_absent
  FROM normalized n
)
SELECT DISTINCT ON (employee_id, work_date)
  email,
  name,
  work_date AS date,
  -- No DST offset: stored times are already US Eastern wall-clock
  TO_CHAR(entry_t, 'HH24:MI') AS entry_time,
  CASE
    WHEN is_excused            THEN 'Excused (PTO/FH/Perm)'
    WHEN is_absent             THEN 'Absent - Unexplained'
    WHEN is_permission         THEN 'Permission'
    WHEN late_minutes = 0      THEN 'On Time'
    WHEN gaf_filed             THEN 'Late - Reported'
    ELSE                            'Late - Unreported'
  END AS status,
  CASE
    WHEN is_excused OR is_permission THEN NULL
    WHEN is_absent                   THEN 'absent'
    WHEN late_minutes = 0            THEN 'on_time'
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
  AND (entry_t IS NOT NULL OR is_excused OR is_permission OR is_absent)
ORDER BY employee_id, work_date, period_name DESC;
