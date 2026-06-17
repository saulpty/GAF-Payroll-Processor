-- Fix the attendance dashboard's on-time calculation.
--
-- BUG: the view RECOMPUTED lateness as (entry_time - shift_start). But entry_time
-- is stored in Panama time (~8:00 AM logins) while the shift comes from the
-- schedule in US Eastern (9:00 AM). So entry < shift for everyone -> 0 minutes
-- late -> "On Time" -> a false ~97% on-time rate.
--
-- FIX: every payroll row already carries the CORRECT lateness in pe.late_minutes
-- (entry - schedule, both in the same Panama clock, so the value is
-- timezone-invariant -- 8:06 vs 8:00 == 9:06 vs 9:00 == 6 min). Use that directly
-- instead of recomputing against a different-timezone shift. This corrects the
-- on-time rate AND the Favian/Arizona case with NO data migration and no timezone
-- guesswork.
--
-- Also:
--  * entry_time is displayed in US Eastern (+1 hour during US DST) so the shown
--    clock lines up with the 9:00 shift instead of reading an hour early.
--  * Reported vs Unreported now keys off whether a GAF form was filed
--    (documentation = 'Form Submitted'), rather than merely whether the day was a
--    Tardanza -- the old logic marked almost every late day as "Reported".
--
-- DROP first to allow column type changes (e.g. date column type fix).

DROP VIEW IF EXISTS public.v_attendance_daily;

CREATE VIEW public.v_attendance_daily AS
WITH
base AS (
  SELECT
    pe.employee_id,
    e.display_name                                            AS name,
    e.teramind_email                                          AS email,
    LEFT(pe.work_date, 10)::date                              AS work_date,
    NULLIF(TRIM(pe.entry_time), '')                           AS entry_time_txt,
    COALESCE(NULLIF(TRIM(pe.event_type_1), ''), '')           AS event_type_1,
    GREATEST(0, COALESCE(pe.late_minutes, 0))::int            AS late_minutes,
    (TRIM(COALESCE(pe.documentation, '')) = 'Form Submitted') AS gaf_filed,
    EXISTS (
      SELECT 1 FROM public.dst_calendar d
      WHERE LEFT(pe.work_date, 10)::date >= d.us_dst_start
        AND LEFT(pe.work_date, 10)::date <  d.us_dst_end
    )                                                          AS is_dst,
    pe.period_name
  FROM public.payroll_entries pe
  JOIN public.employees e ON e.id = pe.employee_id
  WHERE e.active = true
    AND COALESCE(e.excluded_from_payroll, false) = false
),
parsed AS (
  SELECT
    b.*,
    CASE WHEN entry_time_txt IS NULL THEN NULL
         ELSE to_timestamp(entry_time_txt, 'HH12:MI AM')::time END AS entry_t,
    event_type_1 = ANY(ARRAY[
      'PTO','Feriado','Compensatory Day','Birthday Day Off',
      'Ausencia Justificada.','Ausencia Injustificada'
    ])                                                             AS is_excused,
    event_type_1 = ANY(ARRAY[
      'Permiso Remunerado','Permiso No remunerado','Permission','Time Off'
    ])                                                             AS is_permission
  FROM base b
)
SELECT DISTINCT ON (employee_id, work_date)
  email,
  name,
  work_date                                                AS date,
  to_char(
    CASE WHEN is_dst AND entry_t IS NOT NULL THEN entry_t + interval '1 hour' ELSE entry_t END,
    'HH24:MI'
  )                                                        AS entry_time,
  CASE
    WHEN is_excused        THEN 'Excused (PTO/FH/Perm)'
    WHEN is_permission     THEN 'Permission'
    WHEN late_minutes = 0  THEN 'On Time'
    WHEN gaf_filed         THEN 'Late - Reported'
    ELSE                        'Late - Unreported'
  END                                                      AS status,
  CASE
    WHEN is_excused OR is_permission     THEN NULL
    WHEN late_minutes = 0                THEN 'on_time'
    WHEN late_minutes BETWEEN 1  AND 10  THEN 'late_1to10'
    WHEN late_minutes BETWEEN 11 AND 30  THEN 'late_11to30'
    ELSE                                      'late_830plus'
  END                                                      AS bucket,
  gaf_filed                                                AS filed_gaf,
  late_minutes                                             AS minutes_late,
  period_name
FROM parsed
WHERE EXTRACT(ISODOW FROM work_date) < 6
  AND (entry_t IS NOT NULL OR is_excused OR is_permission)
ORDER BY employee_id, work_date, period_name DESC;
