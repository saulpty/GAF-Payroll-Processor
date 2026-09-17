import { action } from '@uibakery/data';

// What payroll needs from the saved Teramind copy: one row per employee per day with the earliest
// record start and the latest record finish (Time Records only). Everything is returned as plain
// integers — YYYYMMDD and minutes since midnight, US Eastern — because date-looking text is
// rewritten on its way to the browser. Only employees payroll actually processes (active, not
// excluded) are returned, scoped to the signed-in viewer. Read-only.
// `manager` is accepted (house rule: every load* takes one); it is not used.
function loadTeramindPunchDays() {
  return action('loadTeramindPunchDays', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT d.employee_id,
             d.teramind_email,
             REPLACE(d.work_date, '-', '')::int                 AS day_ymd,
             REPLACE(LEFT(d.first_start, 10), '-', '')::int     AS first_ymd,
             SUBSTR(d.first_start, 12, 2)::int * 60 + SUBSTR(d.first_start, 15, 2)::int AS first_min,
             REPLACE(LEFT(d.last_finish, 10), '-', '')::int     AS last_ymd,
             SUBSTR(d.last_finish, 12, 2)::int * 60 + SUBSTR(d.last_finish, 15, 2)::int AS last_min,
             d.records,
             d.has_manual
      FROM (
        SELECT e.id                       AS employee_id,
               LOWER(e.teramind_email)    AS teramind_email,
               s.work_date,
               MIN(s.started_et)          AS first_start,
               MAX(s.finished_et)         AS last_finish,
               COUNT(*)::int              AS records,
               BOOL_OR(s.is_manual)       AS has_manual
        FROM public.teramind_sessions s
        JOIN public.employees e ON e.id = s.employee_id
        WHERE s.source = 'time_record'
          AND s.work_date BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
          AND e.active = TRUE
          AND e.excluded_from_payroll = FALSE
          AND COALESCE(e.teramind_email, '') <> ''
          AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                       WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
        GROUP BY e.id, e.teramind_email, s.work_date
      ) d
      ORDER BY d.employee_id, d.work_date;
    `,
  });
}

export default loadTeramindPunchDays;
