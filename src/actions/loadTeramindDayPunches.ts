import { action } from '@uibakery/data';

// One row per employee for ONE day from the saved Teramind copy (Time Records only): first record
// start, last record finish, how many records, seconds of tracked time, and when that employee's
// rows were last refreshed. Times are whole minutes since midnight, US Eastern, as integers —
// date-looking text is rewritten on its way to the browser. Scoped to the signed-in viewer.
// Reads public.v_teramind_records and counts only NOT is_ghost rows, so a stray early record (a
// few minutes of activity followed by an hour or more of nothing) never becomes the entry time.
// ghost_min is the earliest ignored record of that day as minutes since midnight, -1 when none.
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
             COALESCE(SUBSTR(d.ghost_start, 12, 2)::int * 60 + SUBSTR(d.ghost_start, 15, 2)::int, -1) AS ghost_min,
             d.synced_at
      FROM (
        SELECT v.employee_id,
               MIN(v.started_et)  FILTER (WHERE NOT v.is_ghost)   AS first_start,
               MAX(v.finished_et) FILTER (WHERE NOT v.is_ghost)   AS last_finish,
               MIN(v.started_et)  FILTER (WHERE v.is_ghost)       AS ghost_start,
               (COUNT(*)          FILTER (WHERE NOT v.is_ghost))::int AS records,
               (SUM(v.duration_s) FILTER (WHERE NOT v.is_ghost))::int AS active_s,
               BOOL_OR(v.is_manual) FILTER (WHERE NOT v.is_ghost) AS has_manual,
               MAX(v.synced_at)                                   AS synced_at
        FROM public.v_teramind_records v
        JOIN public.employees e ON e.id = v.employee_id
        WHERE v.source = 'time_record'
          AND v.work_date = {{params.day}}::text
          AND e.active = TRUE
          AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                       WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
        GROUP BY v.employee_id
      ) d
      ORDER BY d.employee_id;
    `,
  });
}

export default loadTeramindDayPunches;
