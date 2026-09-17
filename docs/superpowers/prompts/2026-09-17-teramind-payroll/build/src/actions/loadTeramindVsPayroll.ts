import { action } from '@uibakery/data';

// One row per employee per day: Teramind's earliest session start / latest finish beside what
// payroll holds for that day. Read-only. Times are returned as whole minutes since midnight
// (integers) because date-looking text is rewritten on its way to the browser.
// `manager` is accepted (house rule: every load* takes one); filtering by manager happens in React.
function loadTeramindVsPayroll() {
  return action('loadTeramindVsPayroll', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      WITH tm AS (
        SELECT s.employee_id,
               s.work_date,
               MIN(s.started_et)  AS first_start,
               MAX(s.finished_et) AS last_finish,
               COUNT(*)::int      AS sessions,
               MAX(s.duration_s)::int AS longest_s
        FROM public.teramind_sessions s
        WHERE s.employee_id IS NOT NULL
          AND s.work_date BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
        GROUP BY s.employee_id, s.work_date
      ),
      pe AS (
        SELECT DISTINCT ON (p.employee_id, LEFT(p.work_date, 10))
               p.employee_id,
               LEFT(p.work_date, 10) AS work_date,
               p.period_name,
               NULLIF(TRIM(p.entry_time), '') AS entry_time,
               NULLIF(TRIM(p.exit_time), '')  AS exit_time,
               p.event_type_1,
               p.initial_status,
               (p.updated_at > p.created_at + interval '2 minutes') AS touched_after_run
        FROM public.payroll_entries p
        WHERE p.deleted_at IS NULL
          AND LEFT(p.work_date, 10) BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
        ORDER BY p.employee_id, LEFT(p.work_date, 10), p.period_name DESC
      )
      SELECT e.id AS employee_id,
             e.display_name AS name,
             j.work_date AS day,
             j.period_name,
             j.entry_time AS pay_entry,
             j.exit_time  AS pay_exit,
             CASE WHEN UPPER(j.entry_time) ~ '^[0-9]{1,2}:[0-9]{2} ?[AP]M$'
                  THEN (EXTRACT(EPOCH FROM to_timestamp(UPPER(j.entry_time), 'HH12:MI AM')::time) / 60)::int END AS pay_entry_min,
             CASE WHEN UPPER(j.exit_time) ~ '^[0-9]{1,2}:[0-9]{2} ?[AP]M$'
                  THEN (EXTRACT(EPOCH FROM to_timestamp(UPPER(j.exit_time), 'HH12:MI AM')::time) / 60)::int END AS pay_exit_min,
             CASE WHEN j.first_start IS NOT NULL
                  THEN SUBSTR(j.first_start, 12, 2)::int * 60 + SUBSTR(j.first_start, 15, 2)::int END AS tm_entry_min,
             CASE WHEN j.last_finish IS NOT NULL
                  THEN SUBSTR(j.last_finish, 12, 2)::int * 60 + SUBSTR(j.last_finish, 15, 2)::int END AS tm_exit_min,
             (LEFT(j.last_finish, 10) > j.work_date) AS tm_exit_next_day,
             j.sessions,
             j.longest_s,
             j.event_type_1,
             j.initial_status,
             j.touched_after_run
      FROM (
        SELECT COALESCE(tm.employee_id, pe.employee_id) AS employee_id,
               COALESCE(tm.work_date, pe.work_date)     AS work_date,
               tm.first_start, tm.last_finish, tm.sessions, tm.longest_s,
               pe.period_name, pe.entry_time, pe.exit_time, pe.event_type_1, pe.initial_status,
               pe.touched_after_run
        FROM tm
        FULL OUTER JOIN pe ON pe.employee_id = tm.employee_id AND pe.work_date = tm.work_date
      ) j
      JOIN public.employees e ON e.id = j.employee_id
      WHERE e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                     WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ORDER BY j.work_date, e.display_name;
    `,
  });
}

export default loadTeramindVsPayroll;
