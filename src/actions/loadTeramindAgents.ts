import { action } from '@uibakery/data';

function loadTeramindAgents() {
  return action('loadTeramindAgents', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        ta.agent_id,
        ta.employee_id,
        ta.email,
        ta.name,
        ta.deleted,
        ta.linked_by,
        COALESCE(e.display_name, '') AS employee_name,
        ta.synced_at
      FROM teramind_agents ta
      LEFT JOIN employees e ON e.id = ta.employee_id
      ORDER BY ta.name;
    `,
  });
}

export default loadTeramindAgents;
