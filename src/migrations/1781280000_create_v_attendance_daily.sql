-- Create attendance dashboard view: v_attendance_daily
-- Recomputes on-time/late from raw entry_time with NO grace (9:00 sharp).
-- Deliberately independent of payroll initial_status (which uses grace for pay purposes).

CREATE OR REPLACE VIEW public.v_attendance_daily AS
WITH
mapping AS (
  SELECT
    ARRAY[
      'PTO','Feriado','Compensatory Day','Birthday Day Off',
      'Ausencia Justificada.','Ausencia Injustificada'
    ]::text[] AS excused_types,
    ARRAY[
      'Permiso Remunerado','Permiso No remunerado','Permission','Time Off'
    ]::text[] AS permission_types,
    ARRAY[
      'Tardanza','Tardiness'
    ]::text[] AS reported_types
),
base AS (
  SELECT
    pe.employee_id,
    e.display_name                                          AS name,
    e.teramind_email                                        AS email,
    LEFT(pe.work_date, 10)::date                            AS work_date,
    NULLIF(TRIM(pe.entry_time), '')                         AS entry_time_txt,
    pe.event_type_1,
    pe.initial_status,
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
    CASE WHEN entry_time_txt IS NULL THEN NULL
         ELSE to_timestamp(entry_time_txt, 'HH12:MI AM')::time END AS entry_t,
    to_timestamp(shift_start_txt, 'HH12:MI AM')::time              AS shift_t
  FROM base b
),
classified AS (
  SELECT
    p.*,
    CASE WHEN entry_t IS NULL THEN NULL
         ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (entry_t - shift_t)) / 60.0))::int
    END AS minutes_late,
    (event_type_1 = ANY((SELECT excused_types    FROM mapping))) AS is_excused,
    (event_type_1 = ANY((SELECT permission_types FROM mapping))) AS is_permission,
    (event_type_1 = ANY((SELECT reported_types   FROM mapping))) AS is_reported
  FROM parsed p
)
SELECT DISTINCT ON (employee_id, work_date)
  email,
  name,
  work_date                                                AS date,
  to_char(entry_t, 'HH24:MI')                              AS entry_time,
  CASE
    WHEN is_excused     THEN 'Excused (PTO/FH/Perm)'
    WHEN is_permission  THEN 'Permission'
    WHEN minutes_late = 0 THEN 'On Time'
    WHEN is_reported    THEN 'Late - Reported'
    ELSE                     'Late - Unreported'
  END                                                      AS status,
  CASE
    WHEN is_excused OR is_permission THEN NULL
    WHEN minutes_late = 0            THEN 'on_time'
    WHEN minutes_late BETWEEN 1  AND 10  THEN 'late_1to10'
    WHEN minutes_late BETWEEN 11 AND 30  THEN 'late_11to30'
    ELSE                                  'late_830plus'
  END                                                      AS bucket,
  is_reported                                              AS filed_gaf,
  COALESCE(minutes_late, 0)                                AS minutes_late,
  period_name
FROM classified
WHERE EXTRACT(ISODOW FROM work_date) < 6
  AND (entry_t IS NOT NULL OR is_excused OR is_permission)
ORDER BY employee_id, work_date, period_name DESC;
