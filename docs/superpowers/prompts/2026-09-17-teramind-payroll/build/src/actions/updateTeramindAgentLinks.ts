import { action } from '@uibakery/data';

function updateTeramindAgentLinks() {
  return action('updateTeramindAgentLinks', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE teramind_agents t
      SET
        employee_id = (r->>'employee_id')::bigint,
        linked_by = {{params.linked_by}}::text
      FROM jsonb_array_elements({{params.rows}}::jsonb) AS r
      WHERE t.agent_id = (r->>'agent_id')::bigint
        AND (t.linked_by IS NULL OR t.linked_by = 'auto');
    `,
  });
}

export default updateTeramindAgentLinks;
