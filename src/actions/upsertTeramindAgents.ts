import { action } from '@uibakery/data';

function upsertTeramindAgents() {
  return action('upsertTeramindAgents', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO teramind_agents (agent_id, email, name, deleted, raw, synced_at)
      SELECT
        (r->>'agent_id')::bigint,
        r->>'email',
        r->>'name',
        COALESCE((r->>'deleted')::boolean, false),
        (r->'raw'),
        NOW()
      FROM jsonb_array_elements({{params.rows}}::jsonb) AS r
      WHERE public.assert_super({{ user.email }}::text)
      ON CONFLICT (agent_id) DO UPDATE SET
        email   = EXCLUDED.email,
        name    = EXCLUDED.name,
        deleted = EXCLUDED.deleted,
        raw     = EXCLUDED.raw,
        synced_at = NOW();
    `,
  });
}

export default upsertTeramindAgents;
