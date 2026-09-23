import { action } from '@uibakery/data';

function updateTeramindAgentLink() {
  return action('updateTeramindAgentLink', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      WITH updated_agent AS (
        UPDATE teramind_agents
        SET
          employee_id = NULLIF({{params.employee_id}}::text, '')::bigint,
          linked_by = {{params.linked_by}}::text
        WHERE agent_id = {{params.agent_id}}::bigint
          AND public.assert_super({{ user.email }}::text)
        RETURNING agent_id, employee_id
      )
      UPDATE teramind_sessions
      SET employee_id = (SELECT employee_id FROM updated_agent)
      WHERE agent_id = (SELECT agent_id FROM updated_agent)
        AND public.assert_super({{ user.email }}::text);
    `,
  });
}

export default updateTeramindAgentLink;
