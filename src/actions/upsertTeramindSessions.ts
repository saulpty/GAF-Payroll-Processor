import { action } from '@uibakery/data';

// Saves Teramind login sessions. Teramind sometimes returns the same session twice in one
// response, and Postgres refuses to touch a row twice in one ON CONFLICT statement, so the batch
// is de-duplicated on the natural key first (keeping the longest duration).
function upsertTeramindSessions() {
  return action('upsertTeramindSessions', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO teramind_sessions (
        agent_id, employee_id, work_date, started_et, finished_et, started_raw,
        duration_s, computer, raw, synced_at, source, is_manual
      )
      SELECT DISTINCT ON ((r->>'agent_id')::bigint, r->>'started_raw', COALESCE(r->>'computer', ''))
        (r->>'agent_id')::bigint,
        ta.employee_id,
        r->>'work_date',
        r->>'started_et',
        r->>'finished_et',
        r->>'started_raw',
        COALESCE((r->>'duration_s')::int, 0),
        COALESCE(r->>'computer', ''),
        (r->'raw'),
        NOW(),
        COALESCE(NULLIF(r->>'source', ''), 'login_session'),
        COALESCE((r->>'is_manual')::boolean, false)
      FROM jsonb_array_elements({{params.rows}}::jsonb) AS r
      LEFT JOIN teramind_agents ta ON ta.agent_id = (r->>'agent_id')::bigint
      WHERE public.assert_super({{ user.email }}::text)
      ORDER BY (r->>'agent_id')::bigint, r->>'started_raw', COALESCE(r->>'computer', ''),
               COALESCE((r->>'duration_s')::int, 0) DESC
      ON CONFLICT (agent_id, started_raw, computer) DO UPDATE SET
        finished_et   = EXCLUDED.finished_et,
        duration_s    = EXCLUDED.duration_s,
        employee_id   = COALESCE(EXCLUDED.employee_id, teramind_sessions.employee_id),
        raw           = EXCLUDED.raw,
        source        = EXCLUDED.source,
        is_manual     = EXCLUDED.is_manual,
        synced_at     = NOW()
      RETURNING id;
    `,
  });
}

export default upsertTeramindSessions;
