import { action } from '@uibakery/data';

function upsertTeramindSessions() {
  return action('upsertTeramindSessions', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO teramind_sessions (
        agent_id, employee_id, work_date, started_et, finished_et, started_raw,
        duration_s, computer, raw, synced_at
      )
      SELECT
        (r->>'agent_id')::bigint,
        ta.employee_id,
        r->>'work_date',
        r->>'started_et',
        r->>'finished_et',
        r->>'started_raw',
        COALESCE((r->>'duration_s')::int, 0),
        COALESCE(r->>'computer', ''),
        (r->'raw'),
        NOW()
      FROM jsonb_array_elements({{params.rows}}::jsonb) AS r
      LEFT JOIN teramind_agents ta ON ta.agent_id = (r->>'agent_id')::bigint
      ON CONFLICT (agent_id, started_raw, computer) DO UPDATE SET
        finished_et   = EXCLUDED.finished_et,
        duration_s    = EXCLUDED.duration_s,
        employee_id   = COALESCE(EXCLUDED.employee_id, teramind_sessions.employee_id),
        raw           = EXCLUDED.raw,
        synced_at     = NOW()
      RETURNING id;
    `,
  });
}

export default upsertTeramindSessions;
