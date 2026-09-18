import { action } from '@uibakery/data';

// One row per employee per calendar day from the saved Teramind copy (Time Records only): first
// record start, last record finish, seconds of tracked time, record count, the largest gap between
// consecutive records that day (and where it starts), whether any record was hand-typed, how many
// distinct Teramind accounts contributed, and when the day's rows were last refreshed. Times are
// whole minutes since midnight, US Eastern, as integers — date-looking text is rewritten on its way
// to the browser. Only employees payroll actually processes (active, not excluded) are returned,
// scoped to the signed-in viewer. Read-only.
// `manager` is accepted (house rule: every load* takes one); manager filtering happens in React.
function loadTeramindActivityDays() {
  return action('loadTeramindActivityDays', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      WITH filtered AS (
        SELECT s.employee_id, s.work_date, s.started_et, s.finished_et, s.duration_s,
               s.agent_id, s.is_manual, s.synced_at
        FROM public.teramind_sessions s
        JOIN public.employees e ON e.id = s.employee_id
        WHERE s.source = 'time_record'
          AND s.work_date BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
          AND e.active = TRUE
          AND e.excluded_from_payroll = FALSE
          AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                       WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ),
      gapped AS (
        SELECT *,
               LAG(finished_et) OVER (PARTITION BY employee_id, work_date ORDER BY started_et) AS prev_finished_et
        FROM filtered
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
      )
      SELECT f.employee_id,
             REPLACE(f.work_date, '-', '')::int AS work_date,
             (EXTRACT(HOUR FROM MIN(f.started_et)::timestamp) * 60 + EXTRACT(MINUTE FROM MIN(f.started_et)::timestamp))::int AS first_min,
             REPLACE(LEFT(MAX(f.finished_et), 10), '-', '')::int AS last_ymd,
             (EXTRACT(HOUR FROM MAX(f.finished_et)::timestamp) * 60 + EXTRACT(MINUTE FROM MAX(f.finished_et)::timestamp))::int AS last_min,
             SUM(f.duration_s)::int AS active_s,
             COUNT(*)::int AS records,
             COALESCE(gp.largest_gap_min, 0) AS largest_gap_min,
             COALESCE(gp.gap_start_min, 0) AS gap_start_min,
             BOOL_OR(f.is_manual) AS has_manual,
             COUNT(DISTINCT f.agent_id)::int AS accounts,
             MAX(f.synced_at) AS synced_at
      FROM filtered f
      LEFT JOIN gap_pick gp ON gp.employee_id = f.employee_id AND gp.work_date = f.work_date
      GROUP BY f.employee_id, f.work_date, gp.largest_gap_min, gp.gap_start_min
      ORDER BY f.employee_id, f.work_date;
    `,
  });
}

export default loadTeramindActivityDays;
