import { action } from '@uibakery/data';

// One row per employee for ONE day from the saved Teramind copy (Time Records only): first record
// start, last record finish, how many records, seconds of tracked time, and when that employee's
// rows were last refreshed. Times are whole minutes since midnight, US Eastern, as integers —
// date-looking text is rewritten on its way to the browser. Scoped to the signed-in viewer.
// `manager` is accepted (house rule: every load* takes one); manager filtering happens in React.
function loadTeramindDayPunches() {
  return action('loadTeramindDayPunches', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT d.employee_id,
             SUBSTR(d.first_start, 12, 2)::int * 60 + SUBSTR(d.first_start, 15, 2)::int AS first_min,
             REPLACE(LEFT(d.last_finish, 10), '-', '')::int                              AS last_ymd,
             SUBSTR(d.last_finish, 12, 2)::int * 60 + SUBSTR(d.last_finish, 15, 2)::int  AS last_min,
             d.records,
             d.active_s,
             d.has_manual,
             d.synced_at
      FROM (
        SELECT s.employee_id,
               MIN(s.started_et)        AS first_start,
               MAX(s.finished_et)       AS last_finish,
               COUNT(*)::int            AS records,
               SUM(s.duration_s)::int   AS active_s,
               BOOL_OR(s.is_manual)     AS has_manual,
               MAX(s.synced_at)         AS synced_at
        FROM public.teramind_sessions s
        JOIN public.employees e ON e.id = s.employee_id
        WHERE s.source = 'time_record'
          AND s.work_date = {{params.day}}::text
          AND e.active = TRUE
          AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                       WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
        GROUP BY s.employee_id
      ) d
      ORDER BY d.employee_id;
    `,
  });
}

export default loadTeramindDayPunches;
