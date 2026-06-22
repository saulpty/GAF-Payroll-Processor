import { action } from '@uibakery/data';

function loadHrkSummary() {
  return action('loadHrkSummary', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      WITH period_bounds AS (
        SELECT start_date, end_date
        FROM periods
        WHERE period_name = {{params.periodName}}
        LIMIT 1
      ),
      pto_raw AS (
        SELECT
          pe.employee_id,
          TO_DATE(SUBSTRING(pe.work_date FROM 1 FOR 10), 'YYYY-MM-DD') AS pto_date
        FROM payroll_entries pe
        WHERE pe.period_name = {{params.periodName}}
          AND pe.event_type_1 = 'PTO'
      ),
      pto_with_weekends AS (
        -- Original PTO day
        SELECT pr.employee_id, pr.pto_date AS work_date
        FROM pto_raw pr
        UNION ALL
        -- Saturday after a Friday PTO, only if within period
        SELECT pr.employee_id, pr.pto_date + 1
        FROM pto_raw pr
        CROSS JOIN period_bounds pb
        WHERE EXTRACT(DOW FROM pr.pto_date) = 5
          AND pr.pto_date + 1 <= pb.end_date
        UNION ALL
        -- Sunday after a Friday PTO, only if within period
        SELECT pr.employee_id, pr.pto_date + 2
        FROM pto_raw pr
        CROSS JOIN period_bounds pb
        WHERE EXTRACT(DOW FROM pr.pto_date) = 5
          AND pr.pto_date + 2 <= pb.end_date
      ),
      pto_agg AS (
        SELECT
          employee_id,
          COUNT(*)                                                             AS pto_days_total,
          STRING_AGG(TO_CHAR(work_date, 'YYYY-MM-DD'), ', ' ORDER BY work_date) AS pto_dates_all
        FROM pto_with_weekends
        GROUP BY employee_id
      )
      SELECT
        e.display_name                                                          AS employee,
        TO_CHAR(e.start_date, 'YYYY-MM-DD')                                    AS hire_date,

        -- Total Worked Hours: capped at 104h per period
        LEAST(
          ROUND(
            SUM(
              CASE
                WHEN pe.entry_time IS NOT NULL AND pe.exit_time IS NOT NULL
                  AND COALESCE(pe.event_type_1, '') NOT IN (
                    'Feriado','PTO','Permiso Remunerado','Permiso No remunerado',
                    'Ausencia Justificada.','Ausencia Injustificada'
                  )
                THEN (
                  (
                    EXTRACT(HOUR   FROM TO_TIMESTAMP(pe.exit_time,  'HH12:MI AM')) * 60
                    + EXTRACT(MINUTE FROM TO_TIMESTAMP(pe.exit_time,  'HH12:MI AM'))
                  ) - (
                    EXTRACT(HOUR   FROM TO_TIMESTAMP(pe.entry_time, 'HH12:MI AM')) * 60
                    + EXTRACT(MINUTE FROM TO_TIMESTAMP(pe.entry_time, 'HH12:MI AM'))
                  )
                )
                ELSE 0
              END
            )::numeric / 60, 2
          ),
          104
        )                                                                       AS total_worked_hours,

        -- Total Discount Hours
        ROUND(SUM(pe.discount_total_minutes)::numeric / 60, 2)                 AS total_discount_hours,

        -- Incapacidad Days
        COUNT(
          CASE WHEN pe.pay_impact_1 = 'Incapacidad' OR pe.pay_impact_2 = 'Incapacidad'
               THEN 1 END
        )                                                                       AS incapacidad_days,

        -- Incapacidad Dates (yyyy-mm-dd, no redundant conversion)
        COALESCE(
          STRING_AGG(
            CASE WHEN pe.pay_impact_1 = 'Incapacidad' OR pe.pay_impact_2 = 'Incapacidad'
              THEN SUBSTRING(pe.work_date FROM 1 FOR 10) END,
            ', ' ORDER BY pe.work_date
          ), ''
        )                                                                       AS incapacidad_dates,

        -- Constancia Médica count
        COUNT(
          CASE WHEN pe.pay_impact_1 = 'Constancia Medica' OR pe.pay_impact_2 = 'Constancia Medica'
               THEN 1 END
        )                                                                       AS constancia_days,

        -- Constancia Médica Dates & Hours
        COALESCE(
          STRING_AGG(
            CASE WHEN pe.pay_impact_1 = 'Constancia Medica' OR pe.pay_impact_2 = 'Constancia Medica'
              THEN SUBSTRING(pe.work_date FROM 1 FOR 10)
                   || CASE WHEN pe.discount_total_minutes > 0
                        THEN ' (' || ROUND(pe.discount_total_minutes::numeric / 60, 1) || 'h)'
                        ELSE '' END
            END,
            ', ' ORDER BY pe.work_date
          ), ''
        )                                                                       AS constancia_dates_hours,

        -- PTO Days (incl. weekends after Friday PTO within period)
        COALESCE(pa.pto_days_total, 0)                                         AS pto_days,

        -- PTO Dates
        COALESCE(pa.pto_dates_all, '')                                         AS pto_dates,

        -- Aggregated notes (non-empty only)
        COALESCE(
          STRING_AGG(NULLIF(TRIM(pe.notes), ''), '; ' ORDER BY pe.work_date),
          ''
        )                                                                       AS notes

      FROM payroll_entries pe
      JOIN employees e ON e.id = pe.employee_id
      LEFT JOIN pto_agg pa ON pa.employee_id = pe.employee_id
      WHERE pe.period_name = {{params.periodName}}
      GROUP BY e.display_name, e.start_date, pa.pto_days_total, pa.pto_dates_all
      ORDER BY e.display_name;
    `,
  });
}

export default loadHrkSummary;
