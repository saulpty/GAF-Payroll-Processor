-- Append time_off_kind as a tenth column on v_attendance_daily.
--
-- Background: the dashboard needs to break the "Time off" legend entry into
-- its real categories (PTO, holiday, birthday, comp day, approved absence)
-- without changing the donut ring or any KPI number.  The nine existing
-- columns are reproduced exactly — same names, same order — and the new
-- column is appended last.  Postgres CREATE OR REPLACE VIEW allows adding
-- columns at the end but not renaming, reordering, or removing existing ones.
--
-- time_off_kind is NULL on every row that is not Excused (PTO/FH/Perm).
-- It is informational only; all calculations still use the status column.
--
-- Note: 'Ausencia Justificada.' carries a trailing period — it is the literal
-- value stored in payroll_entries.event_type_1 and must be copied exactly.
--
-- Changes from 1781994000: one added CASE ... END AS time_off_kind column;
--   nothing else changed.
-- Rollback: reverting this migration alone is NOT sufficient and will break the
--   Attendance page with "column does not exist". You must also revert
--   src/actions/loadAttendanceDaily.ts (remove time_off_kind from SELECT),
--   src/app/lib/attendanceStats.ts (remove time_off_kind from AttendanceRow),
--   and src/app/pages/attendance/AttendanceDonuts.tsx (remove the breakdown).
--   The view-only rollback degrades to an error rather than a graceful fallback.
--   Safe rollback: re-run 1781994000_v_attendance_daily_split_unexplained_absence.sql
--   AND revert the three source files listed above.

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
  period_name,
  CASE
    WHEN event_type_1 = 'PTO'               THEN 'pto'
    WHEN event_type_1 = 'Feriado'           THEN 'holiday'
    WHEN event_type_1 = 'Birthday Day Off'  THEN 'birthday'
    WHEN event_type_1 = 'Compensatory Day'  THEN 'comp_day'
    WHEN event_type_1 = 'Ausencia Justificada.' THEN 'approved_absence'
    ELSE NULL
  END AS time_off_kind
FROM parsed
WHERE (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])[EXTRACT(ISODOW FROM work_date)::int]
      = ANY (string_to_array(work_days, ','))
  AND (entry_t IS NOT NULL OR is_excused OR is_permission OR is_absent)
ORDER BY employee_id, work_date, period_name DESC;
