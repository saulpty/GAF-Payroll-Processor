import { action } from '@uibakery/data';

// One row per employee per calendar day from the saved Teramind copy (Time Records only): first
// record start, last record finish, seconds of tracked time, record count, the largest gap between
// consecutive records that day (and where it starts), whether any record was hand-typed, how many
// distinct Teramind accounts contributed, and when the day's rows were last refreshed. Times are
// whole minutes since midnight, US Eastern, as integers — date-looking text is rewritten on its way
// to the browser. Only employees payroll actually processes (active, not excluded) are returned,
// scoped to the signed-in viewer. Read-only.
// Reads public.v_teramind_records: every figure above — entry, exit, active time, record count and
// the gap maths — counts only NOT is_ghost rows, so a stray early record (a few minutes of activity
// followed by an hour or more of nothing) never becomes the entry time. ghost_min is the earliest
// ignored record of that day as minutes since midnight, -1 when none.
// `manager` is accepted (house rule: every load* takes one); manager filtering happens in React.
function loadTeramindActivityDays() {
  return action('loadTeramindActivityDays', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      WITH filtered AS (
        SELECT v.employee_id, v.work_date, v.started_et, v.finished_et, v.duration_s,
               v.agent_id, v.is_manual, v.is_ghost, v.synced_at
        FROM public.v_teramind_records v
        JOIN public.employees e ON e.id = v.employee_id
        WHERE v.source = 'time_record'
          AND v.work_date BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
          AND e.active = TRUE
          AND e.excluded_from_payroll = FALSE
          AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                       WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ),
      gapped AS (
        SELECT employee_id, work_date, started_et,
               LAG(finished_et) OVER (PARTITION BY employee_id, work_date ORDER BY started_et) AS prev_finished_et
        FROM filtered
        WHERE NOT is_ghost
      ),
      gaps AS (
        SELECT employee_id, work_date,
               GREATEST(0, ROUND(EXTRACT(EPOCH FROM (started_et::timestamp - prev_finished_et::timestamp)) / 60))::int AS gap_min,
               (EXTRACT(HOUR FROM prev_finished_et::timestamp) * 60 + EXTRACT(MINUTE FROM prev_finished_et::timestamp))::int AS gap_start_min
        FROM gapped
        WHERE prev_finished_et IS NOT NULL
      ),
      gap_pick AS (
        SELECT DISTINCT ON (employee_id, work_date)
               employee_id, work_date, gap_min AS largest_gap_min, gap_start_min
        FROM gaps
        ORDER BY employee_id, work_date, gap_min DESC
      ),
      daily AS (
        SELECT f.employee_id,
               f.work_date,
               MIN(f.started_et)  FILTER (WHERE NOT f.is_ghost)        AS first_start,
               MAX(f.finished_et) FILTER (WHERE NOT f.is_ghost)        AS last_finish,
               MIN(f.started_et)  FILTER (WHERE f.is_ghost)            AS ghost_start,
               (SUM(f.duration_s) FILTER (WHERE NOT f.is_ghost))::int  AS active_s,
               (COUNT(*)          FILTER (WHERE NOT f.is_ghost))::int  AS records,
               BOOL_OR(f.is_manual) FILTER (WHERE NOT f.is_ghost)      AS has_manual,
               (COUNT(DISTINCT f.agent_id) FILTER (WHERE NOT f.is_ghost))::int AS accounts,
               MAX(f.synced_at)                                        AS synced_at
        FROM filtered f
        GROUP BY f.employee_id, f.work_date
      )
      SELECT d.employee_id,
             REPLACE(d.work_date, '-', '')::int AS work_date,
             SUBSTR(d.first_start, 12, 2)::int * 60 + SUBSTR(d.first_start, 15, 2)::int AS first_min,
             REPLACE(LEFT(d.last_finish, 10), '-', '')::int AS last_ymd,
             SUBSTR(d.last_finish, 12, 2)::int * 60 + SUBSTR(d.last_finish, 15, 2)::int AS last_min,
             d.active_s,
             d.records,
             COALESCE(gp.largest_gap_min, 0) AS largest_gap_min,
             COALESCE(gp.gap_start_min, 0) AS gap_start_min,
             d.has_manual,
             d.accounts,
             COALESCE(SUBSTR(d.ghost_start, 12, 2)::int * 60 + SUBSTR(d.ghost_start, 15, 2)::int, -1) AS ghost_min,
             d.synced_at
      FROM daily d
      LEFT JOIN gap_pick gp ON gp.employee_id = d.employee_id AND gp.work_date = d.work_date
      ORDER BY d.employee_id, d.work_date;
    `,
  });
}

export default loadTeramindActivityDays;
