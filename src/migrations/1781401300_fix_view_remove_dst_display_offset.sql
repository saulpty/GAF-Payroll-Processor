-- Remove the +1hr DST cosmetic offset from v_attendance_daily entry_time display.
-- Teramind already reports in US Eastern (DST-adjusted), so stored entry_time values
-- are already the correct Eastern wall-clock times. The view was adding +1hr during
-- DST which caused displayed times to appear 1 hour late (e.g. 9:11 AM → 10:11 AM).
-- late_minutes (stored in payroll_entries) is unaffected and was already correct.

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
    TRIM(COALESCE(pe.documentation, '')) = 'Form Submitted' AS gaf_filed,
    pe.period_name
  FROM payroll_entries pe
  JOIN employees e ON e.id = pe.employee_id
  WHERE e.active = true
    AND COALESCE(e.excluded_from_payroll, false) = false
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
WHERE EXTRACT(isodow FROM work_date) < 6
  AND (entry_t IS NOT NULL OR is_excused OR is_permission)
ORDER BY employee_id, work_date, period_name DESC;
