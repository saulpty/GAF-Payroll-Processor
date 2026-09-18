import { action } from '@uibakery/data';

// What payroll needs from the saved Teramind copy: one row per employee per day with the earliest
// record start and the latest record finish (Time Records only). Everything is returned as plain
// integers — YYYYMMDD and minutes since midnight, US Eastern — because date-looking text is
// rewritten on its way to the browser. Only employees payroll actually processes (active, not
// excluded) are returned, scoped to the signed-in viewer. Read-only.
// Reads public.v_teramind_records and counts only NOT is_ghost rows, so a stray early record (a few
// minutes of activity followed by an hour or more of nothing) never becomes the punch payroll sees.
// ghost_min is the earliest ignored record of that day as minutes since midnight, -1 when none, and
// display_name lets the capture card name the people whose day was corrected.
// `manager` is accepted (house rule: every load* takes one); it is not used.
function loadTeramindPunchDays() {
  return action('loadTeramindPunchDays', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT d.employee_id,
             d.teramind_email,
             d.display_name,
             REPLACE(d.work_date, '-', '')::int                 AS day_ymd,
             REPLACE(LEFT(d.first_start, 10), '-', '')::int     AS first_ymd,
             SUBSTR(d.first_start, 12, 2)::int * 60 + SUBSTR(d.first_start, 15, 2)::int AS first_min,
             REPLACE(LEFT(d.last_finish, 10), '-', '')::int     AS last_ymd,
             SUBSTR(d.last_finish, 12, 2)::int * 60 + SUBSTR(d.last_finish, 15, 2)::int AS last_min,
             d.records,
             d.has_manual,
             COALESCE(SUBSTR(d.ghost_start, 12, 2)::int * 60 + SUBSTR(d.ghost_start, 15, 2)::int, -1) AS ghost_min
      FROM (
        SELECT e.id                       AS employee_id,
               LOWER(e.teramind_email)    AS teramind_email,
               e.display_name             AS display_name,
               v.work_date,
               MIN(v.started_et)  FILTER (WHERE NOT v.is_ghost)   AS first_start,
               MAX(v.finished_et) FILTER (WHERE NOT v.is_ghost)   AS last_finish,
               MIN(v.started_et)  FILTER (WHERE v.is_ghost)       AS ghost_start,
               (COUNT(*)          FILTER (WHERE NOT v.is_ghost))::int AS records,
               BOOL_OR(v.is_manual) FILTER (WHERE NOT v.is_ghost) AS has_manual
        FROM public.v_teramind_records v
        JOIN public.employees e ON e.id = v.employee_id
        WHERE v.source = 'time_record'
          AND v.work_date BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
          AND e.active = TRUE
          AND e.excluded_from_payroll = FALSE
          AND COALESCE(e.teramind_email, '') <> ''
          AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                       WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
        GROUP BY e.id, e.teramind_email, e.display_name, v.work_date
      ) d
      ORDER BY d.employee_id, d.work_date;
    `,
  });
}

export default loadTeramindPunchDays;
