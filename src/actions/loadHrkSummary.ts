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

      -- Mon-Sat days per employee from effective start to period end
      employee_effective_start AS (
        SELECT
          e.id AS employee_id,
          GREATEST(e.start_date, pb.start_date::date) AS eff_start,
          pb.end_date
        FROM employees e
        CROSS JOIN period_bounds pb
      ),

      employee_base AS (
        SELECT
          ees.employee_id,
          (
            SELECT COUNT(*) * 8
            FROM generate_series(ees.eff_start, ees.end_date::date, INTERVAL '1 day') d
            WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 6
          ) AS base_hours
        FROM employee_effective_start ees
      ),

      -- PTO expansion: include consecutive off-days after a PTO day if within period
      pto_raw AS (
        SELECT
          pe.employee_id,
          TO_DATE(SUBSTRING(pe.work_date FROM 1 FOR 10), 'YYYY-MM-DD') AS pto_date,
          COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri') AS work_days
        FROM payroll_entries pe
        JOIN employees e ON e.id = pe.employee_id
        LEFT JOIN schedules s ON s.id = e.schedule_id
        WHERE pe.period_name = {{params.periodName}}
          AND pe.event_type_1 = 'PTO'
          AND pe.deleted_at IS NULL
      ),
      pto_with_offdays AS (
        SELECT pr.employee_id, pr.pto_date AS work_date FROM pto_raw pr
        UNION
        SELECT pr.employee_id, pr.pto_date + 1
        FROM pto_raw pr CROSS JOIN period_bounds pb
        WHERE pr.pto_date + 1 <= pb.end_date::date
          AND (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
                [EXTRACT(ISODOW FROM pr.pto_date + 1)::int]
              <> ALL (string_to_array(pr.work_days, ','))
        UNION
        SELECT pr.employee_id, pr.pto_date + 2
        FROM pto_raw pr CROSS JOIN period_bounds pb
        WHERE pr.pto_date + 2 <= pb.end_date::date
          AND (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
                [EXTRACT(ISODOW FROM pr.pto_date + 1)::int]
              <> ALL (string_to_array(pr.work_days, ','))
          AND (ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])
                [EXTRACT(ISODOW FROM pr.pto_date + 2)::int]
              <> ALL (string_to_array(pr.work_days, ','))
      ),
      pto_agg AS (
        SELECT
          employee_id,
          COUNT(*) AS pto_days_total,
          STRING_AGG(TO_CHAR(work_date, 'YYYY-MM-DD'), ', ' ORDER BY work_date) AS pto_dates_all
        FROM pto_with_offdays
        GROUP BY employee_id
      ),

      -- Base entries filtered to on/after hire date
      entries_filtered AS (
        SELECT pe.*
        FROM payroll_entries pe
        JOIN employees e ON e.id = pe.employee_id
        CROSS JOIN period_bounds pb
        WHERE pe.period_name = {{params.periodName}}
          AND pe.deleted_at IS NULL
          AND TO_DATE(SUBSTRING(pe.work_date FROM 1 FOR 10), 'YYYY-MM-DD')
              >= GREATEST(e.start_date, pb.start_date::date)
      ),

      -- Constancia hours: prefer discount_total_minutes; else parse note time range
      -- Tested patterns: "constancia de 9am - 11am" -> 2h, "Constancia desde 11am a 1:30pm" -> 2.5h
      -- Uses space( *) not \s to avoid template-literal escape issues
      entries_with_constancia AS (
        SELECT
          ef.*,
          CASE
            -- Has Constancia Medica pay impact AND discount minutes set
            WHEN (ef.pay_impact_1 = 'Constancia Medica' OR ef.pay_impact_2 = 'Constancia Medica')
              AND ef.discount_total_minutes > 0
            THEN ef.discount_total_minutes::numeric / 60.0

            -- Has Constancia Medica pay impact, no minutes -> parse time range from note
            WHEN (ef.pay_impact_1 = 'Constancia Medica' OR ef.pay_impact_2 = 'Constancia Medica')
              AND ef.discount_total_minutes = 0
              AND ef.notes ~ '[0-9]{1,2}(:[0-9]{2})? *[ap]m *[-a] *[0-9]{1,2}(:[0-9]{2})? *[ap]m'
            THEN (
              -- end time (last time token in string)
              (CASE
                WHEN ef.notes ~ '[0-9]{1,2}:[0-9]{2} *pm *$'
                  THEN (CAST(REGEXP_REPLACE(ef.notes, '^.*?([0-9]{1,2}):([0-9]{2}) *pm *$', '\\1', 'gi') AS int) % 12 + 12) * 60
                     + CAST(REGEXP_REPLACE(ef.notes, '^.*?([0-9]{1,2}):([0-9]{2}) *pm *$', '\\2', 'gi') AS int)
                WHEN ef.notes ~ '[0-9]{1,2}:[0-9]{2} *am *$'
                  THEN (CAST(REGEXP_REPLACE(ef.notes, '^.*?([0-9]{1,2}):([0-9]{2}) *am *$', '\\1', 'gi') AS int) % 12) * 60
                     + CAST(REGEXP_REPLACE(ef.notes, '^.*?([0-9]{1,2}):([0-9]{2}) *am *$', '\\2', 'gi') AS int)
                WHEN ef.notes ~ '[0-9]{1,2} *pm *$'
                  THEN (CAST(REGEXP_REPLACE(ef.notes, '^.*?([0-9]{1,2}) *pm *$', '\\1', 'gi') AS int) % 12 + 12) * 60
                WHEN ef.notes ~ '[0-9]{1,2} *am *$'
                  THEN (CAST(REGEXP_REPLACE(ef.notes, '^.*?([0-9]{1,2}) *am *$', '\\1', 'gi') AS int) % 12) * 60
                ELSE 0
              END)
              -
              -- start time (first time token in string)
              (CASE
                WHEN ef.notes ~ '^[^0-9]*[0-9]{1,2}:[0-9]{2} *pm'
                  THEN (CAST(REGEXP_REPLACE(ef.notes, '^[^0-9]*([0-9]{1,2}):([0-9]{2}) *pm.*$', '\\1', 'gi') AS int) % 12 + 12) * 60
                     + CAST(REGEXP_REPLACE(ef.notes, '^[^0-9]*([0-9]{1,2}):([0-9]{2}) *pm.*$', '\\2', 'gi') AS int)
                WHEN ef.notes ~ '^[^0-9]*[0-9]{1,2}:[0-9]{2} *am'
                  THEN (CAST(REGEXP_REPLACE(ef.notes, '^[^0-9]*([0-9]{1,2}):([0-9]{2}) *am.*$', '\\1', 'gi') AS int) % 12) * 60
                     + CAST(REGEXP_REPLACE(ef.notes, '^[^0-9]*([0-9]{1,2}):([0-9]{2}) *am.*$', '\\2', 'gi') AS int)
                WHEN ef.notes ~ '^[^0-9]*[0-9]{1,2} *pm'
                  THEN (CAST(REGEXP_REPLACE(ef.notes, '^[^0-9]*([0-9]{1,2}) *pm.*$', '\\1', 'gi') AS int) % 12 + 12) * 60
                WHEN ef.notes ~ '^[^0-9]*[0-9]{1,2} *am'
                  THEN (CAST(REGEXP_REPLACE(ef.notes, '^[^0-9]*([0-9]{1,2}) *am.*$', '\\1', 'gi') AS int) % 12) * 60
                ELSE 0
              END)
            ) / 60.0
            ELSE 0
          END AS constancia_hours_entry,

          -- Flag: note mentions constancia but row is NOT tagged Constancia Medica
          CASE
            WHEN ef.notes ILIKE '%constancia%'
              AND COALESCE(ef.pay_impact_1, '') != 'Constancia Medica'
              AND COALESCE(ef.pay_impact_2, '') != 'Constancia Medica'
            THEN TRUE
            ELSE FALSE
          END AS needs_constancia_review
        FROM entries_filtered ef
      ),

      discount_agg AS (
        SELECT
          employee_id,
          ROUND(SUM(discount_total_minutes)::numeric / 60, 2) AS total_discount_hours
        FROM entries_with_constancia
        GROUP BY employee_id
      ),

      incapacidad_agg AS (
        SELECT
          employee_id,
          COUNT(CASE WHEN pay_impact_1 = 'Incapacidad' OR pay_impact_2 = 'Incapacidad' THEN 1 END) AS incapacidad_days,
          COUNT(CASE WHEN pay_impact_1 = 'Incapacidad' OR pay_impact_2 = 'Incapacidad' THEN 1 END) * 8.0 AS incapacidad_hours,
          COALESCE(STRING_AGG(
            CASE WHEN pay_impact_1 = 'Incapacidad' OR pay_impact_2 = 'Incapacidad'
              THEN SUBSTRING(work_date FROM 1 FOR 10) END,
            ', ' ORDER BY work_date
          ), '') AS incapacidad_dates
        FROM entries_with_constancia
        GROUP BY employee_id
      ),

      constancia_agg AS (
        SELECT
          employee_id,
          COUNT(CASE WHEN pay_impact_1 = 'Constancia Medica' OR pay_impact_2 = 'Constancia Medica' THEN 1 END) AS constancia_days,
          ROUND(SUM(constancia_hours_entry)::numeric, 2) AS constancia_hours_total,
          COALESCE(STRING_AGG(
            CASE WHEN pay_impact_1 = 'Constancia Medica' OR pay_impact_2 = 'Constancia Medica'
              THEN SUBSTRING(work_date FROM 1 FOR 10)
                   || CASE WHEN constancia_hours_entry > 0
                        THEN ' (' || ROUND(constancia_hours_entry::numeric, 1) || 'h)'
                        ELSE '' END
            END,
            ', ' ORDER BY work_date
          ), '') AS constancia_dates_hours
        FROM entries_with_constancia
        GROUP BY employee_id
      ),

      notes_agg AS (
        SELECT
          employee_id,
          COALESCE(STRING_AGG(NULLIF(TRIM(notes), ''), '; ' ORDER BY work_date), '') AS notes,
          BOOL_OR(needs_constancia_review) AS has_constancia_review_flag
        FROM entries_with_constancia
        GROUP BY employee_id
      )

      SELECT
        e.display_name                                                           AS employee,
        TO_CHAR(e.start_date, 'YYYY-MM-DD')                                     AS hire_date,
        eb.base_hours                                                            AS base_hours,

        -- Worked hours = base - discount - incapacidad - constancia (floor 0)
        GREATEST(
          ROUND((
            eb.base_hours
            - COALESCE(da.total_discount_hours, 0)
            - COALESCE(ia.incapacidad_hours, 0)
            - COALESCE(ca.constancia_hours_total, 0)
          )::numeric, 2),
          0
        )                                                                        AS total_worked_hours,

        COALESCE(da.total_discount_hours, 0)                                     AS total_discount_hours,
        COALESCE(ia.incapacidad_days, 0)                                         AS incapacidad_days,
        COALESCE(ia.incapacidad_dates, '')                                       AS incapacidad_dates,
        COALESCE(ca.constancia_days, 0)                                          AS constancia_days,
        COALESCE(ca.constancia_hours_total, 0)                                   AS constancia_hours,
        COALESCE(ca.constancia_dates_hours, '')                                  AS constancia_dates_hours,
        COALESCE(pa.pto_days_total, 0)                                           AS pto_days,
        COALESCE(pa.pto_dates_all, '')                                           AS pto_dates,
        COALESCE(na.notes, '')                                                   AS notes,
        COALESCE(na.has_constancia_review_flag, FALSE)                           AS needs_constancia_review

      FROM employees e
      CROSS JOIN period_bounds pb
      JOIN employee_base eb ON eb.employee_id = e.id
      JOIN (
        SELECT DISTINCT employee_id FROM payroll_entries WHERE period_name = {{params.periodName}} AND deleted_at IS NULL
      ) pe_exists ON pe_exists.employee_id = e.id
      LEFT JOIN discount_agg da ON da.employee_id = e.id
      LEFT JOIN incapacidad_agg ia ON ia.employee_id = e.id
      LEFT JOIN constancia_agg ca ON ca.employee_id = e.id
      LEFT JOIN pto_agg pa ON pa.employee_id = e.id
      LEFT JOIN notes_agg na ON na.employee_id = e.id
      ORDER BY e.display_name;
    `,
  });
}

export default loadHrkSummary;
