import { action } from '@uibakery/data';

// Saved Teramind login sessions for a date range, scoped to the signed-in viewer.
// `manager` is accepted (house rule: every load* takes one); manager filtering happens in React
// with matchesManager, exactly as the Attendance pages do.
function loadTeramindSessions() {
  return action('loadTeramindSessions', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        ts.agent_id,
        ts.employee_id,
        lower(e.teramind_email) AS teramind_email,
        ts.work_date,
        ts.started_et,
        ts.finished_et,
        ts.started_raw,
        ts.duration_s,
        ts.computer
      FROM teramind_sessions ts
      INNER JOIN employees e ON e.id = ts.employee_id
      WHERE ts.work_date BETWEEN {{params.dateFrom}}::text AND {{params.dateTo}}::text
        AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                      WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ORDER BY e.id, ts.started_et;
    `,
  });
}

export default loadTeramindSessions;
